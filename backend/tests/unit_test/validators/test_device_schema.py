from datetime import UTC, datetime
from uuid import uuid4

import pytest
from models.device import DeviceStatus
from pydantic import ValidationError
from schemas.device import (
    DeviceCreate,
    DeviceRead,
    DeviceUpdate,
)


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
        data = {
            "ip_address": "192.168.1.10",
            "mac_address": "A" * 18,
        }

        with pytest.raises(ValidationError):
            DeviceCreate(**data)

    def test_invalid_status(self):
        data = {
            "ip_address": "192.168.1.10",
            "status": "BROKEN",
        }

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
