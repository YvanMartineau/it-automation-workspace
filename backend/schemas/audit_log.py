# audit_log.py
"""
Pydantic schema for the audit log.

Deliberately read-only: there is no AuditLogCreate or AuditLogUpdate here.
Rows are written exclusively by middleware/audit_middleware.write_audit_log()
from inside service functions — never from a request body. Per
<audit_log_implementation>, GET /audit-logs is the only route that will
ever touch this table.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor: str
    action: str
    target_type: str | None
    target_id: str | None
    payload: dict | None
    timestamp: datetime
