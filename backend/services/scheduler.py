"""
services/scheduler.py

APScheduler jobs, started/stopped from main.py's lifespan.

Currently implements: scheduled network discovery scan, per the project's
own decision ("Scheduled full discovery scan: every 10-15 minutes").
Weekly report generation and alert-check jobs are spec'd for this module
too, but are NOT implemented here — the services they'd depend on
(pdf_service/email_service, alerting logic) haven't been built yet, and
scheduling a job against something that doesn't exist would just fail
silently on every interval instead of doing anything useful.

Design notes:
  - AsyncIOScheduler runs jobs directly on FastAPI's existing event loop —
    no separate thread/process. Fine for an I/O-bound job like this one.
  - _run_scheduled_discovery_scan() reuses scanner.run_scan() rather than
    duplicating scan orchestration — the scheduled path and the on-demand
    POST /scan path behave identically, just triggered differently.
  - Every job function is wrapped in a broad try/except. APScheduler
    silently drops an exception raised inside a fired job by default —
    without this, a single failed scan could vanish with no clear log
    entry instead of a traceback tied to "scheduled discovery scan failed".
  - max_instances=1 + coalesce=True: if a scan run is still in progress
    when the next interval fires, don't stack a second one on top of it,
    and if a tick is missed entirely (process was busy/restarting), only
    catch up with one run, not one per missed interval.
"""

import logging
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pydantic import ValidationError

from db.engine import AsyncSessionLocal
from schemas.scan import ScanRequest
from services import scanner
from settings import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_scheduler: AsyncIOScheduler | None = None

# 10-15 minutes was the agreed range; 10 chosen as the floor rather than
# the ceiling — easy to widen later, and the semaphore-bounded scanner is
# cheap enough at typical home/small-office subnet sizes not to need the
# extra margin yet.
DISCOVERY_SCAN_INTERVAL_MINUTES = 10

# Per the AuditLog model's own documented convention for the `actor`
# column ("username or 'system'") — distinct from any real user's email.
SCHEDULED_SCAN_ACTOR = "system"


async def _run_scheduled_discovery_scan(subnet: str) -> None:
    """The job body APScheduler actually fires on each interval."""
    try:
        job_id = uuid.uuid4()
        scanner.create_job(job_id, subnet)
        logger.info("Starting scheduled discovery scan job_id=%s subnet=%s", job_id, subnet)
        await scanner.run_scan(
            job_id=job_id,
            subnet=subnet,
            actor=SCHEDULED_SCAN_ACTOR,
            session_factory=AsyncSessionLocal,
        )
    except Exception:
        logger.exception("Scheduled discovery scan failed")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        logger.warning("start_scheduler() called but a scheduler is already running")
        return

    # Validate once, at app startup — reuses the exact same rule
    # POST /scan enforces (private RFC 1918 only, capped at /22), so a
    # misconfigured ALLOWED_SCAN_SUBNET in .env fails loudly here instead
    # of quietly failing _run_scheduled_discovery_scan() every 10 minutes
    # for the life of the process.
    try:
        validated_subnet = ScanRequest(subnet=settings.ALLOWED_SCAN_SUBNET).subnet
    except ValidationError as err:
        logger.error("ALLOWED_SCAN_SUBNET (%r) failed validation: %s", settings.ALLOWED_SCAN_SUBNET, err)
        raise

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _run_scheduled_discovery_scan,
        trigger=IntervalTrigger(minutes=DISCOVERY_SCAN_INTERVAL_MINUTES),
        args=[validated_subnet],
        id="discovery_scan",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started — discovery scan every %s minutes against %s",
        DISCOVERY_SCAN_INTERVAL_MINUTES,
        validated_subnet,
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    logger.info("Scheduler stopped")