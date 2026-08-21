"""
Runs onboarding as a background task, reporting real progress through
core.job_store: PENDING -> AD_CREATING -> EMAIL_SENDING -> JIRA_CREATING
-> COMPLETED | FAILED.

This changes the n8n workflow from two parallel branches to a sequential
chain (Gmail node, THEN Jira node, each calling back before the next
runs) — a deliberate trade. Parallel branches are faster, but a single
linear status field can only honestly represent one "current step" at a
time, so the workflow's shape now matches what the field can actually say.

Opens its own DB session — never reuses the request-scoped one, since
BackgroundTasks run after the response is already sent and that session
may be closed by then.
"""

import logging
from sqlalchemy import select
from core.exceptions import ConflictError, DomainError
from core.job_store import update_job_status
from db.engine import AsyncSessionLocal
from middleware.audit_middleware import write_audit_log
from services.n8n_client import trigger_onboarding_workflow
from services.password_policy import generate_secure_password
from services.provisioning.factory import build_provisioning_service
from services.onboarding_record_service import create_pending_onboarding_record, upsert_onboarding_record, update_onboarding_job_status
from models.onboarded_user import OnboardedUser, OnboardJobStatus, ProvisioningSource
from settings import get_settings
from services.provisioning.base import ProvisionedUser

logger = logging.getLogger(__name__)

settings = get_settings()


async def run_onboarding_pipeline(job_id, *, user_id, actor_email, first_name, last_name, email, department, job_title) -> None:
    async with AsyncSessionLocal() as db:
        provisioning = build_provisioning_service(db)
        try:
            try:
                await create_pending_onboarding_record(
                    db, user_id=user_id, job_id=job_id, requested_by=actor_email,
                    first_name=first_name, last_name=last_name, email=email,
                    department=department, job_title=job_title,
                    provisioning_source=ProvisioningSource(settings.IDENTITY_PROVIDER),
                )
                await db.commit()
            except ConflictError as err:
                await update_job_status(job_id, "FAILED", {"error": str(err)})
                return

            await update_job_status(job_id, "AD_CREATING")
            provisioned = await provisioning.create_user(
                user_id=user_id, first_name=first_name, last_name=last_name,
                email=email, department=department, job_title=job_title,
            )
            temporary_password = generate_secure_password()
            await provisioning.set_password(provisioned, temporary_password)

            await upsert_onboarding_record(db, provisioned, job_id=job_id, requested_by=actor_email, job_status=OnboardJobStatus.EMAIL_SENDING)
            await write_audit_log(db, actor=actor_email, action="user.onboard", target_type="onboarded_user",
                                   target_id=str(provisioned.user_id),
                                   payload={"department": provisioned.department, "provisioning_source": provisioned.provisioning_source})
            await db.commit()

            await update_job_status(job_id, "EMAIL_SENDING", {
                "user_id": str(provisioned.user_id), "external_id": provisioned.external_id,
                "email": provisioned.email, "department": provisioned.department,
                "job_title": provisioned.job_title, "provisioning_source": provisioned.provisioning_source,
                "temporary_password": temporary_password,
            })

            dispatched = await trigger_onboarding_workflow({
                "job_id": job_id, "user_id": str(provisioned.user_id), "email": provisioned.email,
                "first_name": provisioned.first_name, "last_name": provisioned.last_name,
                "department": provisioned.department, "job_title": provisioned.job_title,
                "temporary_password": temporary_password,
            })
            if not dispatched:
                await update_job_status(job_id, "COMPLETED", {"warning": "Automation could not be dispatched — n8n unreachable"})
                await update_onboarding_job_status(db, job_id, OnboardJobStatus.COMPLETED, error_message="n8n unreachable")
                await db.commit()

        except ConflictError:
            await update_job_status(job_id, "FAILED", {"error": "A directory entry already exists for this email"})
        except DomainError as err:
            await update_job_status(job_id, "FAILED", {"error": str(err)})
        except Exception:
            logger.exception("Onboarding pipeline failed for job_id=%s", job_id)
            await update_job_status(job_id, "FAILED", {"error": "Internal error"})


async def resume_onboarding_pipeline(job_id: str, *, user_id, actor_email: str) -> None:
    """
    Retry path when a directory entry already exists (external_id is set) —
    re-running create_user() here would collide with it. Resumes from
    password reset onward. Always issues a FRESH password rather than
    trying to recover the original: it's never persisted, and if the
    prior attempt died before/during email delivery there's no way to
    know if it ever reached anyone — treating it as compromised and
    reissuing is the only safe default.
    """
    async with AsyncSessionLocal() as db:
        provisioning = build_provisioning_service(db)
        try:
            result = await db.execute(select(OnboardedUser).where(OnboardedUser.id == user_id))
            record = result.scalar_one_or_none()
            if record is None:
                await update_job_status(job_id, "FAILED", {"error": "Original onboarding record not found"})
                return

            await update_job_status(job_id, "AD_CREATING")
            provisioned = ProvisionedUser(
                user_id=record.id, external_id=record.external_id, first_name=record.first_name,
                last_name=record.last_name, email=record.email, department=record.department,
                job_title=record.job_title, status=record.status.value,
                provisioning_source=record.provisioning_source.value,
            )
            temporary_password = generate_secure_password()
            await provisioning.set_password(provisioned, temporary_password)

            record.job_id, record.job_status = job_id, OnboardJobStatus.EMAIL_SENDING
            await db.commit()

            await update_job_status(job_id, "EMAIL_SENDING", {
                "user_id": str(record.id), "external_id": record.external_id, "email": record.email,
                "department": record.department, "job_title": record.job_title,
                "provisioning_source": record.provisioning_source.value, "temporary_password": temporary_password,
            })

            dispatched = await trigger_onboarding_workflow({
                "job_id": job_id, "user_id": str(record.id), "email": record.email,
                "first_name": record.first_name, "last_name": record.last_name,
                "department": record.department, "job_title": record.job_title,
                "temporary_password": temporary_password,
            })
            if not dispatched:
                await update_job_status(job_id, "COMPLETED", {"warning": "Automation could not be dispatched — n8n unreachable"})
                await update_onboarding_job_status(db, job_id, OnboardJobStatus.COMPLETED, error_message="n8n unreachable")
                await db.commit()

        except Exception:
            logger.exception("Resume pipeline failed for job_id=%s", job_id)
            await update_job_status(job_id, "FAILED", {"error": "Internal error during retry"})