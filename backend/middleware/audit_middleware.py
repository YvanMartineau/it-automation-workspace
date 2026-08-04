"""Audit log FastAPI dependency — writes AuditLog on every mutating operation."""
# audit_middleware.py
"""
Audit log writer.

Called by service-layer functions after a mutation succeeds. Per
<audit_log_implementation>: failure to write an audit entry must never
fail the parent operation — it is logged to stderr (structured, via the
standard logging module) and swallowed.

NOTE: this uses the same `db` session as the calling operation and commits
independently. If the audit write itself is expected to be transactionally
atomic with the parent write in a later hardening pass, that's a deliberate
follow-up — not addressed here, since the spec explicitly wants audit
failures to be non-fatal to the primary operation.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from models.audit_log import AuditLog

logger = logging.getLogger("sysops.audit")


async def write_audit_log(
    db: AsyncSession,
    actor: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    payload: dict | None = None,
) -> None:
    """
    Insert an AuditLog row and commit it.

    Wrapped in a broad except by design: an audit-log failure (e.g. a
    transient DB hiccup) must not surface to the client or roll back
    the operation it's documenting. The failure is logged with full
    context for operators instead.
    """
    try:
        log = AuditLog(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=payload,
        )
        db.add(log)
        await db.commit()
    except Exception:
        logger.error(
            "AUDIT LOG WRITE FAILED",
            extra={
                "actor": actor,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
            },
            exc_info=True,
        )