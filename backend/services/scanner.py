"""
services/scanner.py

Async nmap-based subnet scanner.

Two-phase per host, run sequentially inside the same semaphore slot:
  Phase 1 — `-sn` ping sweep. Cheap, run against every host in the subnet.
            Determines up/down, and (on a local Ethernet segment) usually
            already yields hostname + MAC via nmap's own ARP behavior.
            Wall-clock time of this call is recorded as latency_ms — an
            approximation (subprocess + probe time, not pure network RTT),
            documented as such rather than parsed out of nmap's internal
            timing data, which python-nmap doesn't expose cleanly.
  Phase 2 — `-O -F` OS detection + fast port scan (top 100 ports). Runs
            ONLY for hosts phase 1 found "up" — running this against
            hosts that never answered a ping would be pure wasted time,
            and directly works against the conservative-cadence,
            least-privilege scanning posture already decided for this
            project. Needs CAP_NET_RAW/CAP_NET_ADMIN on the container +
            setcap on the nmap binary (see Dockerfile) to work unprivileged.

Local-host enrichment: after the scan completes, any result whose IP
matches one of this machine's own interfaces gets its cpu_percent,
memory_percent, and (if nmap didn't already have it) mac_address filled
in from psutil instead of network probing — legitimate, since this is
local introspection, not remote polling. Every other host's cpu_percent/
memory_percent stays exactly what it was in the DB (see _upsert_device) —
nmap has no way to learn that data about anything but itself.

job_store is a process-local in-memory dict, exactly as spec'd. That's a
deliberate, documented limitation for this deployment: it does NOT survive
a process restart, and it does NOT work correctly if this app is ever run
with more than one worker process. Fine for a single-container Oracle VM
deployment with one Uvicorn worker — flagged here so it's an articulable
trade-off in an interview, not an oversight.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

import nmap
import psutil
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from models.device import Device, DeviceStatus
from middleware.audit_middleware import write_audit_log

logger = logging.getLogger(__name__)

MAX_CONCURRENT_SCANS = 50


@dataclass
class ScanResult:
    ip_address: str
    hostname: str | None
    status: Literal["up", "down"]
    mac_address: str | None
    os_info: str | None = None
    latency_ms: float | None = None
    open_ports: list[dict] | None = None
    # Only ever populated for the local-host enrichment path — every
    # remote host leaves these as None, meaning "don't touch this column".
    cpu_percent: float | None = None
    memory_percent: float | None = None


# ---------------------------------------------------------------------------
# In-memory job registry
# ---------------------------------------------------------------------------
job_store: dict[str, dict[str, Any]] = {}


def create_job(job_id: UUID, subnet: str) -> None:
    job_store[str(job_id)] = {
        "status": "running",
        "queue": asyncio.Queue(),
        "subnet": subnet,
        "started_at": datetime.now(timezone.utc),
        "hosts_total": 0,
        "hosts_scanned": 0,
    }


def get_job(job_id: str) -> dict[str, Any] | None:
    return job_store.get(job_id)


# ---------------------------------------------------------------------------
# nmap result parsing
# ---------------------------------------------------------------------------

def _parse_ping_result(nm: nmap.PortScanner, host: str) -> ScanResult:
    """Parse a completed `-sn` scan for one host."""
    if host not in nm.all_hosts():
        return ScanResult(ip_address=host, hostname=None, status="down", mac_address=None)

    host_data = nm[host]
    state = host_data.state()
    hostname = host_data.hostname() or None
    mac_address = host_data.get("addresses", {}).get("mac")

    return ScanResult(
        ip_address=host,
        hostname=hostname,
        status="up" if state == "up" else "down",
        mac_address=mac_address,
    )


def _parse_os_and_ports(nm: nmap.PortScanner, host: str) -> tuple[str | None, list[dict] | None]:
    """
    Parse a completed `-O -F` scan for one host.

    OS accuracy is deliberately not silently hidden — nmap's osmatch list
    is already ordered best-match-first, and we surface the confidence
    percentage inline so a reviewer of the data knows it's a best-effort,
    unprivileged guess (CW-5 compliant: nmap never runs as root, so this
    is expected to be less accurate than a root-run `-O`, not a bug).
    """
    if host not in nm.all_hosts():
        return None, None

    host_data = nm[host]

    os_info = None
    osmatches = host_data.get("osmatch") or []
    if osmatches:
        best = osmatches[0]
        os_info = f"{best.get('name', 'Unknown')} ({best.get('accuracy', '?')}% confidence)"

    open_ports: list[dict] = []
    for port_num, port_data in host_data.get("tcp", {}).items():
        if port_data.get("state") == "open":
            open_ports.append({"port": port_num, "service": port_data.get("name", "unknown")})

    return os_info, (open_ports or None)


# ---------------------------------------------------------------------------
# Local-host enrichment
# ---------------------------------------------------------------------------

def _get_local_ip_addresses() -> set[str]:
    """All IPv4 addresses bound to this machine's own interfaces."""
    local_ips: set[str] = set()
    for iface_addrs in psutil.net_if_addrs().values():
        for addr in iface_addrs:
            if addr.family == socket.AF_INET:
                local_ips.add(addr.address)
    return local_ips


def _get_local_mac_for_ip(ip: str) -> str | None:
    """Find the MAC address on the same interface that owns `ip`."""
    for iface_addrs in psutil.net_if_addrs().values():
        has_ip = any(a.family == socket.AF_INET and a.address == ip for a in iface_addrs)
        if not has_ip:
            continue
        for a in iface_addrs:
            if a.family == psutil.AF_LINK:
                return a.address
    return None


def _enrich_local_host_sync(result: ScanResult) -> ScanResult:
    """
    Blocking psutil calls — always run via run_in_executor, never awaited
    directly on the event loop (psutil.cpu_percent(interval=...) sleeps).
    """
    try:
        result.cpu_percent = psutil.cpu_percent(interval=0.1)
        result.memory_percent = psutil.virtual_memory().percent
        result.hostname = result.hostname or socket.gethostname()
        result.mac_address = result.mac_address or _get_local_mac_for_ip(result.ip_address)
    except Exception:
        logger.exception("Local-host psutil enrichment failed for %s", result.ip_address)
    return result


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------

async def async_scan_subnet(
    subnet: str,
    on_host_complete: Callable[[ScanResult, int, int], Awaitable[None]] | None = None,
) -> list[ScanResult]:
    network = ipaddress.ip_network(subnet, strict=False)
    hosts = [str(ip) for ip in network.hosts()]
    hosts_total = len(hosts)

    sem = asyncio.Semaphore(MAX_CONCURRENT_SCANS)
    loop = asyncio.get_running_loop()
    scanned_count = 0
    count_lock = asyncio.Lock()

    async def scan_host(host: str) -> ScanResult | None:
        nonlocal scanned_count
        async with sem:
            nm = nmap.PortScanner()
            start = time.monotonic()
            try:
                await loop.run_in_executor(None, nm.scan, host, None, "-sn")
                result = _parse_ping_result(nm, host)
            except Exception:
                logger.exception("nmap ping scan failed for host %s", host)
                result = None
            result_latency_ms = round((time.monotonic() - start) * 1000, 1)

            if result is not None and result.status == "up":
                result.latency_ms = result_latency_ms
                nm_os = nmap.PortScanner()
                try:
                    await loop.run_in_executor(None, nm_os.scan, host, None, "-O -F")
                    os_info, open_ports = _parse_os_and_ports(nm_os, host)
                    result.os_info = os_info
                    result.open_ports = open_ports
                except Exception:
                    logger.exception("nmap OS/port scan failed for host %s", host)

        async with count_lock:
            scanned_count += 1
            current_count = scanned_count

        if on_host_complete and result is not None:
            await on_host_complete(result, current_count, hosts_total)

        return result

    results = await asyncio.gather(*(scan_host(h) for h in hosts), return_exceptions=True)

    scan_results: list[ScanResult] = []
    for r in results:
        if isinstance(r, ScanResult):
            scan_results.append(r)
        elif isinstance(r, Exception):
            logger.error("Unhandled exception during subnet scan: %s", r)

    local_ips = _get_local_ip_addresses()
    for r in scan_results:
        if r.ip_address in local_ips:
            await loop.run_in_executor(None, _enrich_local_host_sync, r)

    return scan_results


# ---------------------------------------------------------------------------
# Device upsert
# ---------------------------------------------------------------------------

async def _upsert_device(db: AsyncSession, result: ScanResult) -> None:
    status = DeviceStatus.online if result.status == "up" else DeviceStatus.offline
    now = datetime.now(timezone.utc)

    stmt = pg_insert(Device).values(
        ip_address=result.ip_address,
        hostname=result.hostname,
        mac_address=result.mac_address,
        status=status,
        os_info=result.os_info,
        latency_ms=result.latency_ms,
        open_ports=result.open_ports,
        cpu_percent=result.cpu_percent,
        memory_percent=result.memory_percent,
        last_seen=now if status == DeviceStatus.online else None,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[Device.ip_address],
        set_={
            "hostname": stmt.excluded.hostname,
            "mac_address": stmt.excluded.mac_address,
            "status": stmt.excluded.status,
            "os_info": stmt.excluded.os_info,
            "latency_ms": stmt.excluded.latency_ms,
            "open_ports": stmt.excluded.open_ports,
            # cpu_percent/memory_percent only ever come from the local-host
            # psutil path. For every other host ScanResult.cpu_percent is
            # None — keep whatever was already stored rather than blanking
            # it out on every remote-host scan pass.
            "cpu_percent": stmt.excluded.cpu_percent if result.cpu_percent is not None else Device.cpu_percent,
            "memory_percent": (
                stmt.excluded.memory_percent if result.memory_percent is not None else Device.memory_percent
            ),
            "last_seen": now if status == DeviceStatus.online else Device.last_seen,
        },
    )
    await db.execute(stmt)


# ---------------------------------------------------------------------------
# Job orchestration
# ---------------------------------------------------------------------------

async def run_scan(
    job_id: UUID,
    subnet: str,
    actor: str,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    job_id_str = str(job_id)
    job = job_store.get(job_id_str)
    if job is None:
        logger.error("run_scan called for unknown job_id=%s", job_id_str)
        return

    queue: asyncio.Queue = job["queue"]

    try:
        job["hosts_total"] = len(list(ipaddress.ip_network(subnet, strict=False).hosts()))
    except ValueError:
        job["hosts_total"] = 0

    async def push_progress(result: ScanResult, scanned: int, total: int) -> None:
        job["hosts_scanned"] = scanned
        job["hosts_total"] = total
        await queue.put(
            {
                "event": "progress",
                "data": {
                    "hosts_found": total,
                    "hosts_scanned": scanned,
                    "current_host": result.ip_address,
                },
            }
        )

    try:
        results = await async_scan_subnet(subnet, on_host_complete=push_progress)

        online = sum(1 for r in results if r.status == "up")
        offline = sum(1 for r in results if r.status == "down")

        async with session_factory() as db:
            try:
                for result in results:
                    await _upsert_device(db, result)
                await db.commit()
            except Exception:
                await db.rollback()
                raise

            await write_audit_log(
                db=db,
                actor=actor,
                action="device.scan.complete",
                target_type="scan_job",
                target_id=job_id_str,
                payload={"subnet": subnet, "total_hosts": len(results), "online": online, "offline": offline},
            )

        job["status"] = "complete"
        await queue.put(
            {"event": "complete", "data": {"total_hosts": len(results), "online": online, "offline": offline}}
        )

    except Exception as exc:
        logger.exception("Scan job %s failed", job_id_str)
        job["status"] = "error"
        await queue.put({"event": "error", "data": {"message": "Scan failed due to an internal error"}})

        try:
            async with session_factory() as db:
                await write_audit_log(
                    db=db,
                    actor=actor,
                    action="device.scan.complete",
                    target_type="scan_job",
                    target_id=job_id_str,
                    payload={"subnet": subnet, "error": str(exc)},
                )
        except Exception:
            logger.exception("Failed to write audit log for failed scan job %s", job_id_str)