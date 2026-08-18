"""
Selects the active UserProvisioningService based on settings.IDENTITY_PROVIDER.
This is the ONLY place that should branch on IDENTITY_PROVIDER.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_db
from services.provisioning.base import UserProvisioningService
from services.provisioning.graph_provider import GraphProvisioningService
from services.provisioning.local_provider import LocalDBProvisioningService
from settings import get_settings

settings = get_settings()


def get_provisioning_service(db: AsyncSession = Depends(get_db)) -> UserProvisioningService:
    if settings.IDENTITY_PROVIDER == "entra_id":
        return GraphProvisioningService()
    return LocalDBProvisioningService(db)