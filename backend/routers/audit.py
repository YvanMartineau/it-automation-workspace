# audit.py
"""
Audit log endpoint:

GET /audit-logs — list audit entries, filterable, admin-only

NOTE: there is deliberately no POST, PUT, or DELETE in this router, and
none should ever be added. The audit_log table is append-only by schema
design (models/audit_log.py) and by a Postgres trigger added in its
migration — the only legitimate write path is
middleware/audit_middleware.write_audit_log(), called internally from
other services. This router exists purely to read what's already there.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_db
from models.user import User
from schemas.audit_log import AuditLogRead
from security.jwt_handler import get_admin_user
from services.audit_log_service import list_audit_logs as list_audit_logs_service

router = APIRouter()


@router.get("/", response_model=list[AuditLogRead], summary="List audit log entries (admin only)")
async def list_audit_logs(
    actor: str | None = Query(default=None),
    action: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> list[AuditLogRead]:
    """
    List audit log entries, newest first, with optional filters.
    Admin-only — this table records who did what to whose data, so
    read access itself must be restricted, not just write access.
    """
    logs = await list_audit_logs_service(
        db, actor, action, target_type, date_from, date_to, limit, offset
    )
    return [AuditLogRead.model_validate(log) for log in logs]