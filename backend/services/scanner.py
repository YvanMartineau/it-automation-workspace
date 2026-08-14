"""
services/scanner.py

Async nmap-based subnet scanner.

Architecture (per spec <network_scanner_implementation>):
  1. routers/scan.py validates the subnet, generates a job_id, calls
     create_job() to register it in job_store, schedules run_scan() as a
     FastAPI BackgroundTask, and returns job_id immediately.
  2. run_scan() drives the scan end to end: it calls async_scan_subnet(),
     which fans out one coroutine per host behind asyncio.Semaphore(50).
     Each host coroutine reports its own result back to run_scan the
     moment it finishes (via the on_host_complete callback), which is what
     lets GET /scan/{job_id}/stream show live, incremental progress
     instead of one lump result at the end.
  3. Each finished host result is upserted into the devices table
     (insert on ip_address, update on conflict — see _upsert_device).
  4. On completion (or on a job-level failure) a terminal SSE event is
     pushed and job_store's status is updated. The stream endpoint closes
     its generator when it sees that terminal event.

job_store is a process-local in-memory dict, exactly as spec'd. That's a
deliberate, documented limitation for this deployment: it does NOT survive
a process restart, and it does NOT work correctly if this app is ever run
with more than one worker process (each worker would have its own
job_store, and a client's SSE connection could land on a worker that never
ran the job). Fine for a single-container Oracle VM deployment with one
Uvicorn worker — flagged here so it's an articulable trade-off in an
interview, not an oversight.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

import nmap
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
    os_info: str | None


# ---------------------------------------------------------------------------
# In-memory job registry
# ---------------------------------------------------------------------------
# job_store[str(job_id)] = {
#     "status": "running" | "complete" | "error",
#     "queue": asyncio.Queue,      # SSE events consumed by the stream route
#     "subnet": str,
#     "started_at": datetime,
#     "hosts_total": int,
#     "hosts_scanned": int,
# }
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
# nmap scanning
# ---------------------------------------------------------------------------

def _parse_nmap_host(nm: nmap.PortScanner, host: str) -> ScanResult:
    """
    Pull one host's result out of a completed PortScanner object. Pure and
    synchronous — safe to call after the executor call returns, no need to
    bounce back to a thread for this part.
    """
    if host not in nm.all_hosts():
        # -sn found nothing for this address at all (host didn't respond
        # to the probe) — treat as down rather than dropping it silently.
        return ScanResult(ip_address=host, hostname=None, status="down", mac_address=None, os_info=None)

    host_data = nm[host]
    state = host_data.state()  # 'up' or 'down'

    hostname = host_data.hostname() or None

    addresses = host_data.get("addresses", {})
    mac_address = addresses.get("mac")

    # -sn (ping scan, no port scan) never runs OS detection — that needs
    # -O, which in turn needs raw-socket privileges. CW-5 says never run
    # nmap as root, so os_info is intentionally left None rather than
    # adding -O. This is expected, not a bug.
    os_info = None

    return ScanResult(
        ip_address=host,
        hostname=hostname,
        status="up" if state == "up" else "down",
        mac_address=mac_address,
        os_info=os_info,
    )


async def async_scan_subnet(
    subnet: str,
    on_host_complete: Callable[[ScanResult, int, int], Awaitable[None]] | None = None,
) -> list[ScanResult]:
    """
    Ping-scan every host in `subnet`, bounded to MAX_CONCURRENT_SCANS
    concurrent nmap subprocesses.

    on_host_complete(result, hosts_scanned, hosts_total), if given, is
    awaited immediately after each individual host finishes — run_scan()
    uses this to push a 'progress' SSE event as each host completes,
    rather than only after the whole gather() resolves.
    """
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
            # A fresh PortScanner per task, not one shared across the
            # semaphore-guarded coroutines: python-nmap's PortScanner
            # keeps scan results as internal instance state, so reusing
            # one instance across concurrent scan_host() calls is a race
            # condition — a second host's result can clobber the first's
            # before it's read. One instance per task avoids that
            # entirely, at the cost of one extra object per host (cheap).
            nm = nmap.PortScanner()
            try:
                # nm.scan() is synchronous and blocks on subprocess I/O.
                # CW-5: it must run in an executor, or it blocks the whole
                # asyncio event loop — not just this coroutine, all of them.
                await loop.run_in_executor(None, nm.scan, host, None, "-sn")
                result = _parse_nmap_host(nm, host)
            except Exception:
                logger.exception("nmap scan failed for host %s", host)
                result = None

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

    return scan_results


# ---------------------------------------------------------------------------
# Device upsert
# ---------------------------------------------------------------------------

async def _upsert_device(db: AsyncSession, result: ScanResult) -> None:
    """
    Insert a new Device row for this IP, or update the existing one on
    conflict. Postgres-native ON CONFLICT DO UPDATE — avoids the
    select-then-write race that a plain "check if exists, then insert or
    update" pattern would have between concurrently completing host tasks.
    """
    status = DeviceStatus.online if result.status == "up" else DeviceStatus.offline
    now = datetime.now(timezone.utc)

    stmt = pg_insert(Device).values(
        ip_address=result.ip_address,
        hostname=result.hostname,
        mac_address=result.mac_address,
        status=status,
        os_info=result.os_info,
        last_seen=now if status == DeviceStatus.online else None,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[Device.ip_address],
        set_={
            "hostname": stmt.excluded.hostname,
            "mac_address": stmt.excluded.mac_address,
            "status": stmt.excluded.status,
            "os_info": stmt.excluded.os_info,
            # Only bump last_seen when this scan actually found the host
            # online — don't overwrite a real last-seen timestamp with
            # NULL just because this particular pass found it offline.
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
    """
    The BackgroundTask entrypoint. Owns the job end-to-end: scanning,
    persisting devices, pushing SSE events, writing the audit trail, and
    updating job_store's terminal state.

    Takes a session_factory rather than a live AsyncSession — this function
    runs after the request that triggered it has already returned its
    response, so the request-scoped `db` session from that request is
    already closed by the time this executes. It must open its own
    session(s). See elite standard #5: DB sessions are never passed across
    service boundaries.

    Wrapped in one broad try/except at the top level: an unhandled
    exception here would otherwise vanish silently inside a BackgroundTask
    (FastAPI does not surface BackgroundTask exceptions to the client —
    the response was already sent) and would leave the job_store entry
    stuck at "running" forever with no terminal SSE event ever sent.
    """
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
                payload={
                    "subnet": subnet,
                    "total_hosts": len(results),
                    "online": online,
                    "offline": offline,
                },
            )

        job["status"] = "complete"
        await queue.put(
            {
                "event": "complete",
                "data": {
                    "total_hosts": len(results),
                    "online": online,
                    "offline": offline,
                },
            }
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