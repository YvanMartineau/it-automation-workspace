import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import String, DateTime, Text, Enum as SQLEnum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.engine import Base


class ReportType(str, Enum):
    SCHEDULED_WEEKLY = "scheduled_weekly"
    MANUAL = "manual"
    ALERT = "alert"


class ReportStatus(str, Enum):
    SENT = "sent"
    FAILED = "failed"


class ReportLog(Base):
    __tablename__ = "report_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    triggered_by: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(ReportStatus, name="report_status_enum"), nullable=False
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)