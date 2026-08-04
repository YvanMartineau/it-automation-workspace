# audit_log_service.py
"""
Audit log query logic.

Deliberately separate from middleware/audit_middleware.py: that module is
the writer, called from inside other services (auth_service, device_service)
after a mutation succeeds. This module is the reader, called only from
routers/audit.py. Keeping them apart mirrors the read/write asymmetry of
the table itself — everything writes through one narrow function, but
querying has several optional filters and belongs with the route that
uses it, not bolted onto the writer.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.audit_log import AuditLog


async def list_audit_logs(
    db: AsyncSession,
    actor: str | None,
    action: str | None,
    target_type: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    limit: int,
    offset: int,
) -> list[AuditLog]:
    """
    Query audit log entries with optional filters, newest first.

    All filters are optional and AND-combined. date_from/date_to filter on
    the `timestamp` column inclusively at each bound.
    """
    query = select(AuditLog)

    if actor is not None:
        query = query.where(AuditLog.actor == actor)
    if action is not None:
        query = query.where(AuditLog.action == action)
    if target_type is not None:
        query = query.where(AuditLog.target_type == target_type)
    if date_from is not None:
        query = query.where(AuditLog.timestamp >= date_from)
    if date_to is not None:
        query = query.where(AuditLog.timestamp <= date_to)

    query = query.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    return list(result.scalars().all())