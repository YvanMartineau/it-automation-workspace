import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ReportType(str, Enum):
    SCHEDULED_WEEKLY = "scheduled_weekly"
    MANUAL = "manual"
    ALERT = "alert"


class ReportTriggerRequest(BaseModel):
    recipient_email: EmailStr
    report_type: ReportType = ReportType.MANUAL


class ReportTriggerResponse(BaseModel):
    report_id: uuid.UUID
    status: str = "queued"


class ReportRead(BaseModel):
    id: uuid.UUID
    report_type: ReportType
    triggered_by: str
    recipient_email: EmailStr
    status: str
    sent_at: datetime
    error_message: str | None = None

    model_config = ConfigDict(from_attributes=True)