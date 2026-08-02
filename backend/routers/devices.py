"""
GET   /devices        — list, filterable by status, paginated
POST  /devices        — create (admin only), writes audit log
PATCH /devices/{id}   — partial update (admin only), writes audit log
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_db
from models.device import Device, DeviceStatus
from models.user import User
from schemas.device import DeviceCreate, DeviceRead, DeviceUpdate
from security.jwt_handler import get_admin_user, get_current_user

router = APIRouter()


@router.get("/", response_model=list[DeviceRead], summary="List devices")
async def list_devices(
    status_filter: DeviceStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Device]:
    query = select(Device)
    if status_filter is not None:
        query = query.where(Device.status == status_filter)
    query = query.order_by(Device.hostname).limit(limit).offset(offset)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=DeviceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a device (admin only)",
)
async def create_device(
    body: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> Device:
    device = Device(**body.model_dump())
    db.add(device)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with ip_address '{body.ip_address}' already exists",
        )

    await db.refresh(device)

    # TODO once write_audit_log exists:
    # await write_audit_log(db, actor=current_user.email, action="device.create",
    #                        target_type="device", target_id=str(device.id),
    #                        payload=body.model_dump(mode="json"))

    return device


@router.patch("/{device_id}", response_model=DeviceRead, summary="Update a device (admin only)")
async def update_device(
    device_id: uuid.UUID,
    body: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> Device:
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    for field, value in update_data.items():
        setattr(device, field, value)

    await db.commit()
    await db.refresh(device)

    # TODO once write_audit_log exists:
    # await write_audit_log(db, actor=current_user.email, action="device.update",
    #                        target_type="device", target_id=str(device.id),
    #                        payload=update_data)

    return device