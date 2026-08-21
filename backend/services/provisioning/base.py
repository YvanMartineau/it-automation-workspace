"""
Provider-agnostic user provisioning interface (ADR-011).

Nothing above this layer — router, n8n_client, audit log payload — should
ever import OnboardedUser or a future Graph SDK client directly. They talk
to ProvisionedUser and UserProvisioningService only, so swapping the active
provider is a settings.IDENTITY_PROVIDER flip, not a rewrite.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID
from datetime import datetime

@dataclass(frozen=True)
class ProvisionedUser:
    """Provider-agnostic result — used to build the API response, the audit
    log payload, and the n8n webhook payload identically regardless of
    which provider created the user."""

    user_id: UUID
    external_id: str | None
    first_name: str
    last_name: str
    email: str
    department: str
    job_title: str
    status: str
    provisioning_source: str
    offboarded_at: datetime | None = None


class UserProvisioningService(ABC):
    @abstractmethod
    async def create_user(self, *, user_id: UUID, first_name: str, last_name: str, email: str, department: str, job_title: str) -> ProvisionedUser:
        """Raises ConflictError on duplicate email."""

    @abstractmethod
    async def set_password(self, user: ProvisionedUser, password: str) -> None:
        """Attach a credential, if the provider supports it."""

    @abstractmethod
    async def deactivate_user(self, user_id: UUID) -> ProvisionedUser:
        """Offboard — always a soft-delete, never a hard delete. Idempotent:
        calling this on an already-offboarded user returns the existing
        record unchanged, never re-stamping offboarded_at to 'now'."""