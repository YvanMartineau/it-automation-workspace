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

from sqlalchemy import DateTime, Enum as SAEnum, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID  # noqa: F401 (JSONB unused here, kept for parity)
from sqlalchemy.orm import Mapped, mapped_column

from db.engine import Base


class OnboardedUserStatus(str, enum.Enum):
    ACTIVE = "active"
    OFFBOARDED = "offboarded"


class ProvisioningSource(str, enum.Enum):
    LOCAL = "local"
    LDAP = "ldap"
    ENTRA_ID = "entra_id"


class OnboardedUser(Base):
    __tablename__ = "onboarded_user"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    offboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)