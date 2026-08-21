"""
GraphProvisioningService — future Entra ID implementation (ADR-011).

Not implemented yet. Writing this against a tenant you can't test it
against would produce unverifiable code, which is worse than no code.
Implement for real once GRAPH_* settings are active; keep the same
interface so nothing above this layer needs to change.
"""

from uuid import UUID

from services.provisioning.base import ProvisionedUser, UserProvisioningService


class GraphProvisioningService(UserProvisioningService):
    async def create_user(self, *, user_id: UUID, first_name, last_name, email, department, job_title) -> ProvisionedUser:
        raise NotImplementedError("GraphProvisioningService is not implemented yet. Set IDENTITY_PROVIDER=local.")

    async def set_password(self, user: ProvisionedUser, password: str) -> None:
        raise NotImplementedError("GraphProvisioningService is not implemented yet.")

    async def deactivate_user(self, user_id: UUID) -> ProvisionedUser:
        raise NotImplementedError("GraphProvisioningService is not implemented yet.")