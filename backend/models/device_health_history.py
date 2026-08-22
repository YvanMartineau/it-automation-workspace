"""
Daily device health snapshots — backs the dashboard's 30-day health trend
and health-alert counts (see services/dashboard.py).

device_id is UUID, matching devices.id exactly (models/device.py). It was
previously typed Integer, which cannot form a valid foreign key against a
UUID primary key — Postgres rejects that constraint at migration time.
Nothing else in the codebase reads/writes this column yet (grep confirms
only services/dashboard.py references DeviceHealthHistory), so widening
the type here doesn't touch any other file's contract.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.engine import Base


class DeviceHealthHistory(Base):
    __tablename__ = "device_health_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    health_score: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_health_history_device_date", "device_id", "recorded_at"),
    )