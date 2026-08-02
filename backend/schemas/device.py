"""Pydantic v2 schemas for Device endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.device import DeviceStatus


class DeviceCreate(BaseModel):
    hostname: str | None = None
    ip_address: str = Field(..., max_length=45)
    mac_address: str | None = Field(default=None, max_length=17)
    status: DeviceStatus = DeviceStatus.unknown
    cpu_percent: float | None = None
    memory_percent: float | None = None
    os_info: str | None = None


class DeviceUpdate(BaseModel):
    """All fields optional — PATCH semantics."""
    hostname: str | None = None
    mac_address: str | None = Field(default=None, max_length=17)
    status: DeviceStatus | None = None
    cpu_percent: float | None = None
    memory_percent: float | None = None
    os_info: str | None = None
    last_seen: datetime | None = None


class DeviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hostname: str | None
    ip_address: str
    mac_address: str | None
    status: DeviceStatus
    cpu_percent: float | None
    memory_percent: float | None
    os_info: str | None
    last_seen: datetime | None
    created_at: datetime
    updated_at: datetime | None