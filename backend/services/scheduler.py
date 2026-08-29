import logging
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from db.engine import AsyncSessionLocal
from models.report_log import ReportType
from pydantic import ValidationError
from schemas.scan import ScanRequest
from settings import get_settings

from services import scanner
from services.report_service import generate_and_send_report_task

logger = logging.getLogger(__name__)

settings = get_settings()

_scheduler: AsyncIOScheduler | None = None

DISCOVERY_SCAN_INTERVAL_MINUTES = 10
SCHEDULED_ACTOR = "system"


async def _run_scheduled_discovery_scan(subnet: str) -> None:
    """The discovery scan job body APScheduler actually fires on each interval."""
    try:
        job_id = uuid.uuid4()
        scanner.create_job(job_id, subnet)
        logger.info("Starting scheduled discovery scan job_id=%s subnet=%s", job_id, subnet)
        await scanner.run_scan(
            job_id=job_id,
            subnet=subnet,
            actor=SCHEDULED_ACTOR,
            session_factory=AsyncSessionLocal,
        )
    except Exception:
        logger.exception("Scheduled discovery scan failed")


async def _run_weekly_report_job() -> None:
    """The weekly report job body APScheduler fires every Monday at 08:00 AM."""
    report_id = uuid.uuid4()
    recipient_email = settings.GMAIL_SENDER_EMAIL
    logger.info(
        "Starting scheduled weekly report generation report_id=%s recipient=%s",
        report_id,
        recipient_email,
    )

    try:
        await generate_and_send_report_task(
            report_id=report_id,
            recipient_email=recipient_email,
            triggered_by=SCHEDULED_ACTOR,
            db_factory=AsyncSessionLocal,
            report_type=ReportType.SCHEDULED_WEEKLY,
        )
        logger.info("Successfully completed weekly report job report_id=%s", report_id)
    except Exception:
        logger.exception("Scheduled weekly report generation failed")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        logger.warning("start_scheduler() called but a scheduler is already running")
        return

    try:
        validated_subnet = ScanRequest(subnet=settings.ALLOWED_SCAN_SUBNET).subnet
    except ValidationError as err:
        logger.error(
            "ALLOWED_SCAN_SUBNET (%r) failed validation: %s", settings.ALLOWED_SCAN_SUBNET, err
        )
        raise

    _scheduler = AsyncIOScheduler()

    # 1. Scheduled Network Discovery Scan Job
    _scheduler.add_job(
        _run_scheduled_discovery_scan,
        trigger=IntervalTrigger(minutes=DISCOVERY_SCAN_INTERVAL_MINUTES),
        args=[validated_subnet],
        id="discovery_scan",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # 2. Scheduled Weekly Executive Report Job (Every Monday at 08:00 AM)
    _scheduler.add_job(
        _run_weekly_report_job,
        trigger=CronTrigger(day_of_week="mon", hour=8, minute=0),
        id="weekly_report",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    _scheduler.start()
    logger.info(
        "Scheduler started — discovery scan every %s minutes against %s | Weekly Mon 8:00",
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
