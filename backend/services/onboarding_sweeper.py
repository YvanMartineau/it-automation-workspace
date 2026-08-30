"""
Resolves onboarding jobs that stopped reporting progress — either the n8n
callback never arrived (workflow died silently) or the worker crashed
before the background task ever ran. Runs on APScheduler, per CW-10:
every exception is caught and logged, never propagated, so one bad tick
can't kill the job permanently.

Row lock (FOR UPDATE SKIP LOCKED) so this is safe even if two scheduler
instances somehow overlap.
"""

import logging
from datetime import UTC, datetime, timedelta

from core.job_store import update_job_status
from db.engine import AsyncSessionLocal
from models.onboarded_user import OnboardedUser, OnboardJobStatus
from settings import get_settings
from sqlalchemy import select

logger = logging.getLogger(__name__)
settings = get_settings()

_STALE_STATUSES = (
    OnboardJobStatus.PENDING,
    OnboardJobStatus.AD_CREATING,
    OnboardJobStatus.EMAIL_SENDING,
    OnboardJobStatus.JIRA_CREATING,
)


async def sweep_stale_onboarding_jobs() -> None:
    try:
        cutoff = datetime.now(UTC) - timedelta(minutes=settings.ONBOARDING_STALE_TIMEOUT_MINUTES)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(OnboardedUser)
                .where(
                    OnboardedUser.job_status.in_(_STALE_STATUSES),
                    OnboardedUser.updated_at < cutoff,
                )
                .with_for_update(skip_locked=True)
            )
            stale_rows = result.scalars().all()

            for record in stale_rows:
                # AD account exists but notifications never confirmed —
                # do NOT wipe it out from under an admin, surface it as
                # partially done. No account at all — safe to mark FAILED
                # for a clean full retry.
                if record.external_id is not None:
                    record.job_status = OnboardJobStatus.PARTIALLY_COMPLETE
                    record.error_message = (
                        f"No confirmation received within "
                        f"{settings.ONBOARDING_STALE_TIMEOUT_MINUTES} min — "
                        f"directory account exists, notifications unconfirmed"
                    )
                else:
                    record.job_status = OnboardJobStatus.FAILED
                    record.error_message = (
                        f"No progress within " f"{settings.ONBOARDING_STALE_TIMEOUT_MINUTES} min"
                    )

                if record.job_id:
                    # Best-effort: unstick a live SSE listener on this worker.
                    # No-ops safely if the job isn't resident here.
                    await update_job_status(
                        record.job_id,
                        record.job_status.value,
                        {"error": record.error_message},
                    )

            await db.commit()
            if stale_rows:
                logger.warning("Onboarding sweeper resolved %d stale job(s)", len(stale_rows))
    except Exception:
        logger.exception("Onboarding sweeper tick failed")
