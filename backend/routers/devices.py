# devices.py
"""
Device management endpoints:

GET    /devices        — paginated, filterable list (search/status/os)
POST   /devices        — create (admin only), writes audit log
PATCH  /devices/{id}   — partial update (admin only), writes audit log
DELETE /devices/{id}   — delete (admin only), writes audit log

Route handlers here do only three things: validate input, call
services/device_service.py, and shape the HTTP response. Query building,
persistence, and audit logging live in the service layer.
"""

import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_db
from models.device import DeviceStatus
from models.user import User
from schemas.device import (
    DeviceCreate,
    DeviceRead,
    DeviceUpdate,
    PaginatedDeviceList,
    PaginationMeta,
)
from security.jwt_handler import get_admin_user, get_current_user
from services.device_service import (
    DeviceConflictError,
    DeviceNotFoundError,
    NoUpdateFieldsError,
)
from services.device_service import create_device as create_device_service
from services.device_service import delete_device as delete_device_service
from services.device_service import list_devices_paginated
from services.device_service import update_device as update_device_service

router = APIRouter()


@router.get("/", response_model=PaginatedDeviceList, summary="List devices (paginated, filterable)")
async def list_devices(
    status_filter: DeviceStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, description="Matches hostname, IP, or MAC"),
    os: str | None = Query(default=None, description="Substring match against os_info"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedDeviceList:
    """
    List devices with optional status/search/OS filters, paginated.
    Requires an authenticated user; no role escalation here — matches the
    access level of the original unpaginated endpoint.
    """
    devices, total_items = await list_devices_paginated(
        db, status_filter=status_filter, search=search, os_filter=os, page=page, page_size=page_size
    )
    total_pages = math.ceil(total_items / page_size) if total_items else 0

    return PaginatedDeviceList(
        data=[DeviceRead.model_validate(d) for d in devices],
        meta=PaginationMeta(page=page, pageSize=page_size, totalPages=total_pages, totalItems=total_items),
    )


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
) -> DeviceRead:
    """
    Create a new device.
    Admin-only; enforces uniqueness on ip_address and returns 409 on conflict.
    """
    try:
        device = await create_device_service(db, current_user.email, body)
    except DeviceConflictError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(err),
        )

    return DeviceRead.model_validate(device)


@router.patch("/{device_id}", response_model=DeviceRead, summary="Update a device (admin only)")
async def update_device(
    device_id: uuid.UUID,
    body: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> DeviceRead:
    """
    Partially update an existing device.
    Admin-only; rejects empty payloads and handles missing devices with 404.
    """
    try:
        device = await update_device_service(db, current_user.email, device_id, body)
    except DeviceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    except NoUpdateFieldsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    return DeviceRead.model_validate(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a device (admin only)")
async def delete_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> None:
    """
    Delete a device.
    Admin-only; handles missing devices with 404. Writes an audit entry
    (with the device's ip/hostname captured before deletion) — see
    services/device_service.py's delete_device.
    """
    try:
        await delete_device_service(db, current_user.email, device_id)
    except DeviceNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )