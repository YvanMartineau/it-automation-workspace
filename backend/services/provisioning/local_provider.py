"""
LocalDBProvisioningService — interim identity provider (ADR-011).
Stores onboarded users in our own Postgres instead of Entra ID.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from models.onboarded_user import OnboardedUser, OnboardedUserStatus, ProvisioningSource
from services.provisioning.base import ProvisionedUser, UserProvisioningService

logger = logging.getLogger(__name__)


class LocalDBProvisioningService(UserProvisioningService):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, *, user_id, first_name, last_name, email, department, job_title) -> ProvisionedUser:
        result = await self.db.execute(select(OnboardedUser).where(OnboardedUser.id == user_id))
        record = result.scalar_one_or_none()
        if record is None:
            raise NotFoundError(f"No pending record for user_id '{user_id}' — the pipeline must insert it first")
        record.first_name, record.last_name = first_name, last_name
        record.email, record.department, record.job_title = email, department, job_title
        await self.db.flush()
        return ProvisionedUser(
            user_id=record.id, external_id=None, first_name=record.first_name, last_name=record.last_name,
            email=record.email, department=record.department, job_title=record.job_title,
            status=record.status.value, provisioning_source=record.provisioning_source.value,
        )

    async def set_password(self, user: ProvisionedUser, password: str) -> None:
        """
        No-op by design — there's no directory account to attach a credential
        to yet. We still generate the password upstream (services/password_policy.py)
        so the CSPRNG code path stays exercised and demonstrable; this just
        makes explicit that it currently goes nowhere.
        """
        logger.debug(
            "set_password no-op for local provisioning (user_id=%s) — no directory account exists yet.",
            user.user_id,
        )

    async def deactivate_user(self, user_id: UUID) -> ProvisionedUser:
        result = await self.db.execute(select(OnboardedUser).where(OnboardedUser.id == user_id))
        record = result.scalar_one_or_none()
        if record is None:
            raise NotFoundError(f"No onboarded user with id '{user_id}'")

        if record.status != OnboardedUserStatus.OFFBOARDED:
            record.status = OnboardedUserStatus.OFFBOARDED
            record.offboarded_at = datetime.now(timezone.utc)
            await self.db.flush()

        return ProvisionedUser(
            user_id=record.id,
            external_id=None,
            first_name=record.first_name,
            last_name=record.last_name,
            email=record.email,
            department=record.department,
            job_title=record.job_title,
            status=record.status.value,
            provisioning_source=record.provisioning_source.value,
            offboarded_at=record.offboarded_at,
        )