"""
Runs onboarding as a background task, reporting real progress through
core.job_store: PENDING -> AD_CREATING -> EMAIL_SENDING -> JIRA_CREATING
-> COMPLETED | PARTIALLY_COMPLETE | FAILED.

The PENDING row is written synchronously by the route handler
(routers/onboard.py::onboard_user) BEFORE this background task is ever
scheduled — that's what lets a worker crash between "202 Accepted" and
this function actually running still leave something for the sweeper to
find. This module never creates that row itself.

external_id is persisted to Postgres in its own commit immediately after
create_user() succeeds, before set_password() or anything else runs.
Postgres and the directory must never be allowed to disagree about
whether the account exists — if they do, a retry re-attempts create_user()
against an entry that's already there and collides with itself.

Opens its own DB session — never reuses the request-scoped one, since
BackgroundTasks run after the response is already sent and that session
may be closed by then.
"""

import logging

from core.exceptions import ConflictError, DomainError
from core.job_store import update_job_status
from db.engine import AsyncSessionLocal
from middleware.audit_middleware import write_audit_log
from models.onboarded_user import OnboardedUser, OnboardJobStatus
from settings import get_settings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.n8n_client import trigger_onboarding_workflow
from services.onboarding_record_service import (
    update_onboarding_job_status,
    upsert_onboarding_record,
)
from services.password_policy import generate_secure_password
from services.provisioning.base import ProvisionedUser
from services.provisioning.factory import build_provisioning_service

logger = logging.getLogger(__name__)

settings = get_settings()


async def _mark_job_failed(db: AsyncSession, job_id: str, error_message: str) -> None:
    """
    Dual-write on failure: the in-memory job_store so any live SSE listener
    sees it immediately, and Postgres so the record is durable without
    waiting for the sweeper. Rolls back first in case the triggering
    exception left the session's transaction unusable.
    """
    await update_job_status(job_id, "FAILED", {"error": error_message})
    try:
        await db.rollback()
        await update_onboarding_job_status(
            db, job_id, OnboardJobStatus.FAILED, error_message=error_message
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to persist FAILED status to Postgres for job_id=%s", job_id)


async def run_onboarding_pipeline(
    job_id, *, user_id, actor_email, first_name, last_name, email, department, job_title
) -> None:
    async with AsyncSessionLocal() as db:
        provisioning = build_provisioning_service(db)
        try:
            await update_job_status(job_id, "AD_CREATING")
            provisioned = await provisioning.create_user(
                user_id=user_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                department=department,
                job_title=job_title,
            )

            # Durable the moment the directory account exists — before
            # set_password or anything else that could still fail.
            await upsert_onboarding_record(
                db,
                provisioned,
                job_id=job_id,
                requested_by=actor_email,
                job_status=OnboardJobStatus.AD_CREATING,
            )
            await db.commit()

            temporary_password = generate_secure_password()
            await provisioning.set_password(provisioned, temporary_password)

            await upsert_onboarding_record(
                db,
                provisioned,
                job_id=job_id,
                requested_by=actor_email,
                job_status=OnboardJobStatus.EMAIL_SENDING,
            )
            await write_audit_log(
                db,
                actor=actor_email,
                action="user.onboard",
                target_type="onboarded_user",
                target_id=str(provisioned.user_id),
                payload={
                    "department": provisioned.department,
                    "provisioning_source": provisioned.provisioning_source,
                },
            )
            await db.commit()

            # temporary_password is still generated and still sent to n8n below; it's
            # just no longer written into job.data, so it can never come back out of
            # the stream, on this call or any later one, ever.
            await update_job_status(
                job_id,
                "EMAIL_SENDING",
                {
                    "user_id": str(provisioned.user_id),
                    "external_id": provisioned.external_id,
                    "email": provisioned.email,
                    "department": provisioned.department,
                    "job_title": provisioned.job_title,
                    "provisioning_source": provisioned.provisioning_source,
                },
            )

            dispatched = await trigger_onboarding_workflow(
                {
                    "job_id": job_id,
                    "user_id": str(provisioned.user_id),
                    "email": provisioned.email,
                    "first_name": provisioned.first_name,
                    "last_name": provisioned.last_name,
                    "department": provisioned.department,
                    "job_title": provisioned.job_title,
                    "temporary_password": temporary_password,
                    "password_rotated": True,
                }
            )
            if not dispatched:
                # AD account exists, notifications never left the building —
                # this is PARTIALLY_COMPLETE, never COMPLETED. Only the n8n
                # callback (after Jira confirms) is allowed to set COMPLETED.
                await update_job_status(
                    job_id,
                    "PARTIALLY_COMPLETE",
                    {"warning": "Automation could not be dispatched — n8n unreachable"},
                )
                await update_onboarding_job_status(
                    db, job_id, OnboardJobStatus.PARTIALLY_COMPLETE, error_message="n8n unreachable"
                )
                await db.commit()

        except ConflictError as err:
            await _mark_job_failed(db, job_id, str(err))
        except DomainError as err:
            await _mark_job_failed(db, job_id, str(err))
        except Exception:
            logger.exception("Onboarding pipeline failed for job_id=%s", job_id)
            await _mark_job_failed(db, job_id, "Internal error")


async def resume_onboarding_pipeline(
    job_id: str, *, user_id, actor_email: str, rotate_password: bool = True
) -> None:
    """
    Retry path when a directory entry already exists (external_id is set) —
    re-running create_user() here would collide with it. Resumes from
    password reset onward, unless rotate_password=False: a retry caused by
    a lost n8n callback may mean the original password already reached the
    user, and rotating it on every retry would invalidate a credential
    someone may have already used to log in.
    """
    async with AsyncSessionLocal() as db:
        provisioning = build_provisioning_service(db)
        try:
            result = await db.execute(select(OnboardedUser).where(OnboardedUser.id == user_id))
            record = result.scalar_one_or_none()
            if record is None:
                await update_job_status(
                    job_id, "FAILED", {"error": "Original onboarding record not found"}
                )
                return

            # job_id/job_status durable BEFORE set_password — if set_password
            # throws, Postgres already points at this job_id, so
            # _mark_job_failed can actually find and update the row instead
            # of silently updating nothing.
            record.job_id, record.job_status = job_id, OnboardJobStatus.AD_CREATING
            await db.commit()

            await update_job_status(job_id, "AD_CREATING")
            provisioned = ProvisionedUser(
                user_id=record.id,
                external_id=record.external_id,
                first_name=record.first_name,
                last_name=record.last_name,
                email=record.email,
                department=record.department,
                job_title=record.job_title,
                status=record.status.value,
                provisioning_source=record.provisioning_source.value,
            )

            temporary_password = None
            if rotate_password:
                temporary_password = generate_secure_password()
                await provisioning.set_password(provisioned, temporary_password)

            record.job_status = OnboardJobStatus.EMAIL_SENDING
            await db.commit()

            await update_job_status(
                job_id,
                "EMAIL_SENDING",
                {
                    "user_id": str(record.id),
                    "external_id": record.external_id,
                    "email": record.email,
                    "department": record.department,
                    "job_title": record.job_title,
                },
            )

            dispatched = await trigger_onboarding_workflow(
                {
                    "job_id": job_id,
                    "user_id": str(record.id),
                    "email": record.email,
                    "first_name": record.first_name,
                    "last_name": record.last_name,
                    "department": record.department,
                    "job_title": record.job_title,
                    "temporary_password": temporary_password,  # null if not rotated
                    "password_rotated": rotate_password,  # n8n branches on this
                }
            )
            if not dispatched:
                await update_job_status(
                    job_id,
                    "PARTIALLY_COMPLETE",
                    {"warning": "Automation could not be dispatched — n8n unreachable"},
                )
                await update_onboarding_job_status(
                    db, job_id, OnboardJobStatus.PARTIALLY_COMPLETE, error_message="n8n unreachable"
                )
                await db.commit()

        except Exception:
            logger.exception("Resume pipeline failed for job_id=%s", job_id)
            await _mark_job_failed(db, job_id, "Internal error during retry")
