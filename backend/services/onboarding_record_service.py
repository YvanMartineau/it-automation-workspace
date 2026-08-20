"""
Maintains OnboardedUser as the platform's own operational record — written
for every onboarding regardless of which IDENTITY_PROVIDER handled the
real directory write.

upsert() is get-or-create by id (== ProvisionedUser.user_id): the local
backend already creates this row directly (Postgres IS the directory in
that mode), so this must annotate that existing row, never duplicate it.
LDAP/Entra never touch this table themselves, so for those backends this
is the row's only source.

update_status()/mark_offboarded() operate on an already-existing row —
by the time either is called, upsert() has already run once.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.onboarded_user import OnboardedUser, OnboardedUserStatus, OnboardJobStatus, ProvisioningSource
from services.provisioning.base import ProvisionedUser


async def upsert_onboarding_record(
    db: AsyncSession, provisioned: ProvisionedUser, *, job_id: str, requested_by: str, job_status: OnboardJobStatus,
) -> OnboardedUser:
    result = await db.execute(select(OnboardedUser).where(OnboardedUser.id == provisioned.user_id))
    record = result.scalar_one_or_none()

    if record is None:
        record = OnboardedUser(
            id=provisioned.user_id,
            first_name=provisioned.first_name,
            last_name=provisioned.last_name,
            email=provisioned.email,
            department=provisioned.department,
            job_title=provisioned.job_title,
            provisioning_source=ProvisioningSource(provisioned.provisioning_source),
            external_id=provisioned.external_id,
        )
        db.add(record)

    record.job_id = job_id
    record.job_status = job_status
    record.requested_by = requested_by
    await db.flush()
    return record


async def update_onboarding_job_status(
    db: AsyncSession, job_id: str, job_status: OnboardJobStatus, error_message: str | None = None,
) -> None:
    result = await db.execute(select(OnboardedUser).where(OnboardedUser.job_id == job_id))
    record = result.scalar_one_or_none()
    if record is None:
        return  # failed before the record existed at all — nothing to update, not an error
    record.job_status = job_status
    if error_message:
        record.error_message = error_message
    await db.flush()


async def mark_offboarded(db: AsyncSession, user_id: UUID, offboarded_at: datetime) -> None:
    result = await db.execute(select(OnboardedUser).where(OnboardedUser.id == user_id))
    record = result.scalar_one_or_none()
    if record is not None:
        record.status = OnboardedUserStatus.OFFBOARDED
        record.offboarded_at = offboarded_at
        await db.flush()
