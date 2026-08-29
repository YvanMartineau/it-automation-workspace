import uuid
from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ReportType(str, Enum):
    SCHEDULED_WEEKLY = "scheduled_weekly"
    MANUAL = "manual"
    ALERT = "alert"


class ReportTriggerRequest(BaseModel):
    report_type: Literal[
        "overview", "asset_inventory", "device_health", "onboarding_summary", "compliance_audit"
    ] = Field(..., description="The classification of the report to generate.")
    start_date: datetime | None = Field(None, description="Start date for the report data range.")
    end_date: datetime | None = Field(None, description="End date for the report data range.")


class ReportJobResponse(BaseModel):
    job_id: uuid.UUID
    status: Literal["queued", "running", "completed", "failed"]
    error_message: str | None = None


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_name: str
    report_type: str
    triggered_by: str
    recipient_email: str
    status: str
    sent_at: datetime
    error_message: str | None = None
