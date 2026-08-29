from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OnboardRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    department: str = Field(..., min_length=1, max_length=100)
    job_title: str = Field(..., min_length=1, max_length=100)


class OnboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID  # internal identity, stable across provider swaps
    external_id: str | None  # populated once real Entra ID provisioning exists
    email: EmailStr
    department: str
    job_title: str
    status: str
    provisioning_source: str
    temporary_password: str  # returned once only — never persisted, never logged


class OffboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    status: str
    offboarded_at: datetime | None


class OnboardedUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID = Field(validation_alias="id")
    job_id: str | None
    external_id: str | None
    first_name: str
    last_name: str
    email: EmailStr
    department: str
    job_title: str
    status: str
    job_status: str = Field(
        serialization_alias="workflow_status"
        # serialization_alias (not alias) is deliberate — it only changes
        # the outbound JSON key, leaving the from_attributes lookup against
        # the ORM object's actual job_status attribute untouched.
    )
    provisioning_source: str
    requested_by: str | None
    error_message: str | None
    created_at: datetime
    offboarded_at: datetime | None
