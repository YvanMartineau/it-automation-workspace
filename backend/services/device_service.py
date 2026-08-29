# device_service.py
"""
Device inventory business logic.

Routers call into this module; it owns query building, persistence, and
audit logging for the device table. Deliberately HTTP-agnostic — this
module raises plain exceptions, and routers translate them into the
appropriate HTTPException.
"""

import uuid
from dataclasses import dataclass

from middleware.audit_middleware import write_audit_log
from models.device import Device, DeviceStatus
from models.device_health_history import DeviceHealthHistory
from schemas.device import DeviceCreate, DeviceUpdate
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class DeviceCounts:
    total: int
    online: int
    offline: int
    health_alerts: int
    critical_alerts: int


class DeviceConflictError(Exception):
    """Raised when a device with the same ip_address already exists."""

    def __init__(self, ip_address: str):
        self.ip_address = ip_address
        super().__init__(f"Device with ip_address '{ip_address}' already exists")


class DeviceNotFoundError(Exception):
    """Raised when a device_id does not match any row."""


class NoUpdateFieldsError(Exception):
    """Raised when a PATCH body contains no fields to update."""


async def list_devices_paginated(
    db: AsyncSession,
    status_filter: DeviceStatus | None,
    search: str | None,
    os_filter: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Device], int]:
    """
    List devices with optional status/search/OS filters, paginated, plus
    the total matching count. Replaces the old list_devices() (removed —
    routers/devices.py's GET / now calls this instead, since the frontend
    needs a real total for AssetPagination, which an unbounded
    LIMIT/OFFSET list alone can't provide).

    Two queries, not one: SQLAlchemy has no single-round-trip way to get
    both a LIMIT/OFFSET page and an unbounded COUNT(*) of the same
    filtered set. Both share the same WHERE conditions, built once below,
    so they can't drift out of sync with each other.
    """
    conditions = []
    if status_filter is not None:
        conditions.append(Device.status == status_filter)
    if search:
        pattern = f"%{search}%"
        conditions.append(
            or_(
                Device.hostname.ilike(pattern),
                Device.ip_address.ilike(pattern),
                Device.mac_address.ilike(pattern),
            )
        )
    if os_filter:
        # os_info is nmap's free-text OS-match string (e.g. "Linux 5.X
        # (88% confidence)") — substring match is the only filtering that
        # makes sense against it; there's no clean enum column to match.
        conditions.append(Device.os_info.ilike(f"%{os_filter}%"))

    count_stmt = select(func.count()).select_from(Device)
    list_stmt = select(Device).order_by(Device.hostname.asc().nulls_last())

    if conditions:
        count_stmt = count_stmt.where(*conditions)
        list_stmt = list_stmt.where(*conditions)

    total_items = (await db.execute(count_stmt)).scalar_one()

    list_stmt = list_stmt.limit(page_size).offset((page - 1) * page_size)
    devices = (await db.execute(list_stmt)).scalars().all()

    return list(devices), total_items


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
    except IntegrityError as err:
        await db.rollback()
        raise DeviceConflictError(data.ip_address) from err

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


async def delete_device(db: AsyncSession, actor: str, device_id: uuid.UUID) -> None:
    """
    Delete a device. Admin-only + audit-logged, same pattern as
    create/update above. Audits BEFORE deleting, since the device's own
    identifying details (ip/hostname) wouldn't exist to log afterward.
    """
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise DeviceNotFoundError()

    await write_audit_log(
        db=db,
        actor=actor,
        action="device.delete",
        target_type="device",
        target_id=str(device_id),
        payload={"ip_address": device.ip_address, "hostname": device.hostname},
    )
    await db.delete(device)
    await db.commit()


async def get_health_alert_counts(db: AsyncSession) -> tuple[int, int]:
    """
    Devices whose MOST RECENT health-history score is below threshold.
    This is the ONLY place this should ever be computed — both
    GET /dashboard and GET /devices/stats call this, specifically because
    two independent implementations (one reading history, one deriving
    client-side from live status/cpu/memory) is what caused the Dashboard
    and Assets pages to disagree.
    """
    ranked = (
        select(
            DeviceHealthHistory.device_id,
            DeviceHealthHistory.health_score,
            func.row_number()
            .over(
                partition_by=DeviceHealthHistory.device_id,
                order_by=DeviceHealthHistory.recorded_at.desc(),
            )
            .label("rn"),
        )
    ).subquery()

    stmt = (
        select(
            func.count().filter(ranked.c.health_score < 85).label("alerts"),
            func.count().filter(ranked.c.health_score < 70).label("critical"),
        )
        .select_from(ranked)
        .where(ranked.c.rn == 1)
    )
    row = (await db.execute(stmt)).one()
    return row.alerts or 0, row.critical or 0


async def get_device_counts(db: AsyncSession) -> DeviceCounts:
    """Total/online/offline + health alerts — one shared aggregate for both pages."""
    device_stmt = select(
        func.count(Device.id).label("total"),
        func.count(Device.id).filter(Device.status == DeviceStatus.online).label("online"),
        func.count(Device.id).filter(Device.status == DeviceStatus.offline).label("offline"),
    )
    row = (await db.execute(device_stmt)).one()
    health_alerts, critical_alerts = await get_health_alert_counts(db)
    return DeviceCounts(
        total=row.total or 0,
        online=row.online or 0,
        offline=row.offline or 0,
        health_alerts=health_alerts,
        critical_alerts=critical_alerts,
    )

