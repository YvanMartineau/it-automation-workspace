# models/onboarded_user.py
"""
New-hire identity record.

Interim system of record while settings.IDENTITY_PROVIDER == "local"
(ADR-011) — this table plays the role Entra ID will play once Graph API
access exists. `provisioning_source` and `external_id` exist specifically
to support that future migration: when a real Entra ID account is created
for an existing row, external_id gets populated and provisioning_source
flips to "entra_id".

Deliberately separate from models.user.User: User is people who log into
THIS platform (role: admin/viewer). OnboardedUser is employees processed
THROUGH the platform's automation — a different entity, different lifecycle.
"""

import enum
import uuid
from datetime import datetime

from db.engine import Base
from sqlalchemy import DateTime, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB  # noqa: F401 (JSONB unused here, kept for parity)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column


class OnboardedUserStatus(str, enum.Enum):
    ACTIVE = "active"
    OFFBOARDED = "offboarded"


class ProvisioningSource(str, enum.Enum):
    LOCAL = "local"
    LDAP = "ldap"
    ENTRA_ID = "entra_id"


class OnboardJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    AD_CREATING = "AD_CREATING"
    EMAIL_SENDING = "EMAIL_SENDING"
    JIRA_CREATING = "JIRA_CREATING"
    PARTIALLY_COMPLETE = "PARTIALLY_COMPLETE"  # AD account exists; email/Jira not confirmed
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"  # AD account was never created


class OnboardedUser(Base):
    __tablename__ = "onboarded_user"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    job_title: Mapped[str] = mapped_column(String(100), nullable=False)

    status: Mapped[OnboardedUserStatus] = mapped_column(
        SAEnum(OnboardedUserStatus, name="onboarded_user_status"),
        nullable=False,
        default=OnboardedUserStatus.ACTIVE,
    )
    provisioning_source: Mapped[ProvisioningSource] = mapped_column(
        SAEnum(ProvisioningSource, name="provisioning_source"),
        nullable=False,
        default=ProvisioningSource.LOCAL,
    )
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # New: operational-record fields. Deliberately separate from `status`
    # (active/offboarded — the person's current access state) — job_status
    # tracks the ONBOARDING OPERATION itself, and stops changing once it
    # reaches COMPLETED or FAILED.
    job_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    job_status: Mapped[OnboardJobStatus] = mapped_column(
        SAEnum(OnboardJobStatus, name="onboard_job_status"),
        nullable=False,
        default=OnboardJobStatus.PENDING,
    )
    requested_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    offboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
