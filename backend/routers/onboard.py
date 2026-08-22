"""
POST /onboard — starts onboarding as an async job (real progress tracking).
POST /onboard/{user_id}/offboard — revokes access, soft-delete, idempotent.
GET /onboard — the platform's own operational record (Postgres), not a
live directory query. GET /onboard/jobs/{job_id}/stream — SSE progress.
POST /onboard/jobs/{job_id}/status — n8n's callback, shared-secret guarded.
"""

import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from uuid import uuid4
from core.exceptions import NotFoundError
from core.job_store import create_job, get_job, update_job_status
from db.engine import get_db
from models.onboarded_user import OnboardedUser, OnboardJobStatus
from models.user import User
from schemas.onboard import OffboardResponse, OnboardedUserListItem, OnboardRequest
from security.jwt_handler import get_admin_user, get_current_user
from middleware.audit_middleware import write_audit_log
from services.n8n_client import trigger_offboarding_workflow
from services.onboarding_pipeline import resume_onboarding_pipeline, run_onboarding_pipeline
from services.onboarding_record_service import mark_offboarded, update_onboarding_job_status
from services.provisioning.base import UserProvisioningService
from services.provisioning.factory import get_provisioning_service
from settings import get_settings

router = APIRouter(prefix="/onboard", tags=["onboarding"])
settings = get_settings()


class OnboardJobStarted(BaseModel):
    job_id: str
    status: str


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=OnboardJobStarted, summary="Start onboarding a new hire")
async def onboard_user(body: OnboardRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_admin_user)) -> OnboardJobStarted:
    job = create_job(initial_status="PENDING")
    user_id = uuid4()
    background_tasks.add_task(
        run_onboarding_pipeline, job.job_id, user_id=user_id,
        actor_email=current_user.email, first_name=body.first_name, last_name=body.last_name,
        email=body.email, department=body.department, job_title=body.job_title,
    )
    return OnboardJobStarted(job_id=job.job_id, status=job.status)

@router.get("/jobs/{job_id}/stream", summary="Stream onboarding progress")
async def stream_onboarding_progress(job_id: str, current_user: User = Depends(get_admin_user)):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job_id")

    async def event_generator():
        yield {"event": "status", "data": json.dumps({"status": job.status, "data": job.data})}
        while True:
            event = await job.queue.get()
            yield {"event": "status", "data": json.dumps(event)}
            if event["status"] in ("COMPLETED", "FAILED"):
                break

    return EventSourceResponse(event_generator())


class JobStatusCallback(BaseModel):
    status: Literal["JIRA_CREATING", "COMPLETED", "FAILED"]
    error: str | None = None


@router.post("/jobs/{job_id}/status", status_code=status.HTTP_204_NO_CONTENT, summary="n8n status callback (internal)")
async def report_job_status(
    job_id: str,
    body: JobStatusCallback,
    x_callback_secret: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not settings.N8N_CALLBACK_SECRET or x_callback_secret != settings.N8N_CALLBACK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing callback secret")

    if get_job(job_id) is None:
        # In-memory store may have been wiped by a dev-server restart —
        # Postgres is the durable source of truth, check there before 404ing.
        result = await db.execute(select(OnboardedUser).where(OnboardedUser.job_id == job_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Unknown job_id")
        # Job existed — update the persisted record even though no live
        # SSE listener remains for it. update_job_status() below already
        # no-ops safely when the in-memory job is gone, so nothing extra
        # needed there.

    await update_job_status(job_id, body.status, {"error": body.error} if body.error else None)
    await update_onboarding_job_status(db, job_id, OnboardJobStatus(body.status), error_message=body.error)
    await db.commit()


@router.post(
    "/{user_id}/offboard",
    response_model=OffboardResponse,
    summary="Offboard a user",
    description=(
        "Revokes directory access for a previously onboarded user — soft-delete "
        "(status flip), never a hard delete. Idempotent: re-calling on an "
        "already-offboarded user is a no-op that returns the original record."
    ),
)
async def offboard_user(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    provisioning: UserProvisioningService = Depends(get_provisioning_service),
) -> OffboardResponse:
    try:
        deactivated = await provisioning.deactivate_user(user_id)
    except NotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err

    await mark_offboarded(db, deactivated.user_id, deactivated.offboarded_at)

    await write_audit_log(
        db,
        actor=current_user.email,
        action="user.offboard",
        target_type="onboarded_user",
        target_id=str(user_id),
        payload={"department": deactivated.department, "provisioning_source": deactivated.provisioning_source},
    )
    await db.commit()

    background_tasks.add_task(
        trigger_offboarding_workflow,
        {
            "user_id": str(deactivated.user_id),
            "email": deactivated.email,
            "first_name": deactivated.first_name,
            "last_name": deactivated.last_name,
            "department": deactivated.department,
        },
    )

    return OffboardResponse(
        user_id=deactivated.user_id,
        status=deactivated.status,
        offboarded_at=deactivated.offboarded_at,
    )


@router.get(
    "",
    response_model=list[OnboardedUserListItem],
    summary="List onboarded users",
    description=(
        "Reads the platform's own operational record (Postgres), not live "
        "from whichever directory backend is active. Never includes "
        "temporary_password — that value is never persisted anywhere."
    ),
)
async def list_onboarded_users(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> list[OnboardedUserListItem]:
    result = await db.execute(
        select(OnboardedUser).order_by(OnboardedUser.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


@router.post("/jobs/{job_id}/retry", status_code=status.HTTP_202_ACCEPTED, response_model=OnboardJobStarted, summary="Retry a failed onboarding job")
async def retry_onboarding(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> OnboardJobStarted:
    result = await db.execute(select(OnboardedUser).where(OnboardedUser.job_id == job_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown job_id")
    if record.job_status != OnboardJobStatus.FAILED:
        raise HTTPException(status_code=409, detail=f"Only FAILED jobs can be retried (current: {record.job_status.value})")

    new_job = create_job(initial_status="PENDING")
    record.job_id, record.job_status, record.error_message = new_job.job_id, OnboardJobStatus.PENDING, None
    await db.commit()

    if record.external_id is None:
        background_tasks.add_task(
            run_onboarding_pipeline, new_job.job_id, user_id=record.id, actor_email=current_user.email,
            first_name=record.first_name, last_name=record.last_name, email=record.email,
            department=record.department, job_title=record.job_title,
        )
    else:
        background_tasks.add_task(resume_onboarding_pipeline, new_job.job_id, user_id=record.id, actor_email=current_user.email)

    return OnboardJobStarted(job_id=new_job.job_id, status=new_job.status)