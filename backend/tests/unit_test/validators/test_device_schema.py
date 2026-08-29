# backend/tests/unit_test/validators/test_device_schema.py
from datetime import UTC

import pytest
from models.device import DeviceStatus  # this import requires models/device.py
from pydantic import AliasChoices, BaseModel, Field, ValidationError
from schemas.device import (
    DeviceCreate,
    DeviceRead,
    DeviceUpdate,
    PaginationMeta,
)


class PaginationMeta(BaseModel):
    page: int
    page_size: int = Field(alias="pageSize", validation_alias=AliasChoices("page_size", "pageSize"))
    total_pages: int = Field(
        alias="totalPages", validation_alias=AliasChoices("total_pages", "totalPages")
    )
    total_items: int = Field(
        alias="totalItems", validation_alias=AliasChoices("total_items", "totalItems")
    )

    class Config:
        populate_by_name = True


class TestDeviceCreate:
    def test_valid_device_create(self):
        data = {"ip_address": "192.168.1.10"}
        device = DeviceCreate(**data)
        assert device.ip_address == "192.168.1.10"
        assert device.status == DeviceStatus.unknown

    def test_missing_ip(self):
        with pytest.raises(ValidationError):
            DeviceCreate()

    def test_ip_too_long(self):
        data = {"ip_address": "1" * 46}
        with pytest.raises(ValidationError):
            DeviceCreate(**data)

    def test_mac_too_long(self):
        data = {"ip_address": "192.168.1.10", "mac_address": "A" * 18}
        with pytest.raises(ValidationError):
            DeviceCreate(**data)

    def test_invalid_status(self):
        data = {"ip_address": "192.168.1.10", "status": "BROKEN"}
        with pytest.raises(ValidationError):
            DeviceCreate(**data)


class TestDeviceUpdate:
    def test_all_fields_optional(self):
        update = DeviceUpdate()
        assert update.hostname is None
        assert update.status is None

    def test_invalid_status(self):
        with pytest.raises(ValidationError):
            DeviceUpdate(status="BROKEN")


class TestDeviceRead:
    def test_from_orm_object(self):
        from datetime import datetime
        from uuid import uuid4

        obj = {
            "id": uuid4(),
            "hostname": "test-host",
            "ip_address": "192.168.1.10",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "status": DeviceStatus.online,
            "cpu_percent": 25.5,
            "memory_percent": 40.2,
            "os_info": "Ubuntu 22.04",
            "latency_ms": 12.3,
            "open_ports": [{"port": 22, "service": "ssh"}],
            "last_seen": datetime.now(UTC),
            "created_at": datetime.now(UTC),
            "updated_at": None,
        }
        read = DeviceRead(**obj)
        assert read.ip_address == "192.168.1.10"


# To fix in V2
# class TestPaginatedDeviceList:
#    def test_camel_case_meta(self):
#       from uuid import uuid4
#
#        data = {
#            "data": [
#                DeviceRead(
#                    id=uuid4(),
#                    hostname=None,
#                    ip_address="192.168.1.10",
#                    mac_address=None,
#                    status=DeviceStatus.unknown,
#                    cpu_percent=None,
#                    memory_percent=None,
#                    os_info=None,
#                    latency_ms=None,
#                    open_ports=None,
#                    last_seen=None,
#                    created_at=None,
#                    updated_at=None,
#                )
#            ],
#            "meta": PaginationMeta(page=1, pageSize=10, totalPages=5, totalItems=50),
#        }
#        paginated = PaginatedDeviceList(**data)
#        # Access using snake_case (Python convention)
#        assert paginated.meta.page_size == 10
#        assert paginated.meta.total_pages == 5
#        assert paginated.meta.total_items == 50
