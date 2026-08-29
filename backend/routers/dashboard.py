from db.engine import get_db
from fastapi import APIRouter, Depends
from models.user import User
from schemas.dashboard import DashboardSnapshot
from security.jwt_handler import get_current_user
from services.dashboard import DashboardService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSnapshot)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a complete dashboard snapshot.

    This is a single aggregated endpoint to minimize HTTP round-trips
    and respect the Aiven max_connections=20 constraint.
    """
    service = DashboardService(db)
    return await service.get_snapshot()
