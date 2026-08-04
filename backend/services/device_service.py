# device_service.py
"""
Device inventory business logic.

Routers call into this module; it owns query building, persistence, and
audit logging for the device table. Deliberately HTTP-agnostic — this
module raises plain exceptions, and routers translate them into the
appropriate HTTPException.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from middleware.audit_middleware import write_audit_log
from models.device import Device, DeviceStatus
from schemas.device import DeviceCreate, DeviceUpdate


class DeviceConflictError(Exception):
    """Raised when a device with the same ip_address already exists."""

    def __init__(self, ip_address: str):
        self.ip_address = ip_address
        super().__init__(f"Device with ip_address '{ip_address}' already exists")


class DeviceNotFoundError(Exception):
    """Raised when a device_id does not match any row."""


class NoUpdateFieldsError(Exception):
    """Raised when a PATCH body contains no fields to update."""


async def list_devices(
    db: AsyncSession,
    status_filter: DeviceStatus | None,
    limit: int,
    offset: int,
) -> list[Device]:
    """List devices with optional status filter and pagination."""
    query = select(Device)
    if status_filter is not None:
        query = query.where(Device.status == status_filter)
    query = query.order_by(Device.hostname).limit(limit).offset(offset)

    result = await db.execute(query)
    return list(result.scalars().all())


async def create_device(db: AsyncSession, actor: str, data: DeviceCreate) -> Device:
    """
    Create a new device.

    Uniqueness on ip_address is enforced at the DB level; an IntegrityError
    there is translated into DeviceConflictError for the router to turn
    into a 409. Writes an audit entry only after the commit succeeds.
    """
    device = Device(**data.model_dump())
    db.add(device)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DeviceConflictError(data.ip_address)

    await db.refresh(device)

    await write_audit_log(
        db,
        actor=actor,
        action="device.create",
        target_type="device",
        target_id=str(device.id),
        payload=data.model_dump(mode="json"),
    )

    return device


async def update_device(
    db: AsyncSession,
    actor: str,
    device_id: uuid.UUID,
    data: DeviceUpdate,
) -> Device:
    """
    Partially update an existing device.

    Raises DeviceNotFoundError if the id doesn't exist and NoUpdateFieldsError
    if the caller sent an effectively empty PATCH body (all fields unset).
    Writes an audit entry only after the commit succeeds.
    """
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if device is None:
        raise DeviceNotFoundError()

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise NoUpdateFieldsError()

    for field, value in update_data.items():
        setattr(device, field, value)

    await db.commit()
    await db.refresh(device)

    await write_audit_log(
        db,
        actor=actor,
        action="device.update",
        target_type="device",
        target_id=str(device.id),
        payload=update_data,
    )

    return device