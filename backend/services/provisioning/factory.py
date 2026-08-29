"""
Selects the active UserProvisioningService based on settings.IDENTITY_PROVIDER.
This is the ONLY place that should branch on IDENTITY_PROVIDER.
"""

from db.engine import get_db
from fastapi import Depends
from services.provisioning.base import UserProvisioningService
from services.provisioning.graph_provider import GraphProvisioningService
from services.provisioning.ldap_provider import LdapProvisioningService
from services.provisioning.local_provider import LocalDBProvisioningService
from settings import get_settings
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()


def build_provisioning_service(db: AsyncSession) -> UserProvisioningService:
    """Plain constructor — usable from background tasks/scripts, not just route handlers."""
    if settings.IDENTITY_PROVIDER == "entra_id":
        return GraphProvisioningService()
    if settings.IDENTITY_PROVIDER == "ldap":
        return LdapProvisioningService()
    return LocalDBProvisioningService(db)


def get_provisioning_service(db: AsyncSession = Depends(get_db)) -> UserProvisioningService:
    """FastAPI dependency wrapper — use this in route signatures only."""
    return build_provisioning_service(db)
