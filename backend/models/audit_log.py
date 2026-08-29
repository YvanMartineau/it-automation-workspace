# audit_log.py
"""
AuditLog ORM model.

Append-only by construction:
  - No `updated_at` column — there is nothing to track "last modified" for.
  - No relationships defined on this model, so nothing can cascade an
    UPDATE or DELETE onto it from elsewhere in the ORM graph.
  - target_id is a plain String, not a ForeignKey. Deliberate: this table
    logs actions against both internal rows (Device UUIDs) and external
    identifiers (Entra ID / Graph user IDs) that don't share one type or
    one table. A FK would only fit one of those and would also open the
    door to ON DELETE CASCADE silently deleting audit history — which is
    exactly what this table must never allow.

This model gives you application-level append-only behavior. It is NOT
sufficient on its own — per <audit_trigger_sql> in the spec, a Postgres
trigger must also be added in the Alembic migration to hard-block UPDATE
and DELETE at the database level, since Alembic autogenerate will not
create that trigger for you (CW-12). See the migration note below.
"""

import uuid

from db.engine import Base  # adjust this import if Base lives elsewhere, e.g. db/base.py
from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    target_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    timestamp: Mapped["DateTime"] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} actor={self.actor!r} action={self.action!r}>"
