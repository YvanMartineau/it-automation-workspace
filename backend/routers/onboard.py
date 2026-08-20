"""
POST /onboard — new hire onboarding. Currently provisions locally
(IDENTITY_PROVIDER=local, ADR-011) pending Entra ID access; the route
itself doesn't know or care which provider is active.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError
from db.engine import get_db
from models.user import User
from schemas.onboard import OnboardRequest, OnboardResponse
from security.jwt_handler import get_admin_user
from middleware.audit_middleware import write_audit_log
from services.n8n_client import trigger_onboarding_workflow
from services.password_policy import generate_secure_password
from services.provisioning.base import UserProvisioningService
from services.provisioning.factory import get_provisioning_service

router = APIRouter(prefix="/onboard", tags=["onboarding"])


# TODO: @limiter.limit("10/minute") once security/rate_limiter.py + main.py
# app-level Limiter wiring exist. Router logic below is otherwise complete.
@router.post(
    "",
    response_model=OnboardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new hire",
    description=(
        "Creates a new hire's identity record and temporary password, writes "
        "an audit log entry, and fires the n8n workflow (non-blocking). "
        "Provisions locally pending Entra ID access — see ADR-011."
    ),
)
async def onboard_user(
    body: OnboardRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    provisioning: UserProvisioningService = Depends(get_provisioning_service),
) -> OnboardResponse:
    try:
        provisioned = await provisioning.create_user(
            first_name=body.first_name,
            last_name=body.last_name,
            email=body.email,
            department=body.department,
            job_title=body.job_title,
        )
    except ConflictError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err

    temporary_password = generate_secure_password()
    await provisioning.set_password(provisioned, temporary_password)

    await write_audit_log(
        db,
        actor=current_user.email,
        action="user.onboard",
        target_type="onboarded_user",
        target_id=str(provisioned.user_id),
        payload={
            "department": provisioned.department,
            "job_title": provisioned.job_title,
            "provisioning_source": provisioned.provisioning_source,
            # password is never included here
        },
    )

    await db.commit()

    background_tasks.add_task(
        trigger_onboarding_workflow,
        {
            "user_id": str(provisioned.user_id),
            "email": provisioned.email,
            "first_name": provisioned.first_name,
            "last_name": provisioned.last_name,
            "department": provisioned.department,
            "job_title": provisioned.job_title,
            "temporary_password": temporary_password,
        },
    )

    return OnboardResponse(
        user_id=provisioned.user_id,
        external_id=provisioned.external_id,
        email=provisioned.email,
        department=provisioned.department,
        job_title=provisioned.job_title,
        status=provisioned.status,
        provisioning_source=provisioned.provisioning_source,
        temporary_password=temporary_password,
    )