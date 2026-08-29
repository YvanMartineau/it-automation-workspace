import uuid

from db.engine import AsyncSessionLocal, get_db
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import Response
from models.report_log import ReportLog
from models.user import User  # Ensure User model is imported for proper typing
from schemas.report import ReportJobResponse, ReportRead, ReportTriggerRequest
from security.jwt_handler import get_admin_user, get_current_user
from services.report_service import REPORT_JOBS, generate_manual_report_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post(
    "/trigger",
    response_model=ReportJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger manual PDF report generation",
    description="Queues PDF generation via BackgroundTask. Returns a job ID to poll for completion.",
)
async def trigger_report(
    payload: ReportTriggerRequest,
    background_tasks: BackgroundTasks,
    # FIXED: Type hint is User, not dict
    current_user: User = Depends(get_admin_user),
):
    job_id = uuid.uuid4()

    # 1. THE ACTOR FIX: Use the human email for the audit log
    actor_email = current_user.email

    # 2. THE SCHEMA FIX: Generate the missing required fields
    # e.g., "overview" becomes "Manual Overview Report"
    dynamic_report_name = f"Manual {payload.report_type.replace('_', ' ').title()} Report"

    # Initialize job state
    REPORT_JOBS[job_id] = {"status": "queued"}

    background_tasks.add_task(
        generate_manual_report_task,
        job_id=job_id,
        report_name=dynamic_report_name,
        report_type=payload.report_type,
        actor=actor_email,  # fixed identifier
        recipient_email=actor_email,  # Now safely passing a string instead of a function
        db_factory=AsyncSessionLocal,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )

    return ReportJobResponse(job_id=job_id, status="queued")


@router.get(
    "/{job_id}/status",
    response_model=ReportJobResponse,
    summary="Check status of a queued report",
)
async def get_report_status(
    job_id: uuid.UUID,
    current_user: User = Depends(get_admin_user),
):
    job = REPORT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Report job not found or expired.")

    return ReportJobResponse(
        job_id=job_id, status=job["status"], error_message=job.get("error_message")
    )


@router.get(
    "/{job_id}/download",
    response_class=Response,
    summary="Download a completed report PDF",
    description="Downloads the PDF and clears it from server memory. Can only be downloaded once.",
)
async def download_report(
    job_id: uuid.UUID,
    current_user: User = Depends(get_admin_user),
):
    job = REPORT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Report job not found.")

    if job["status"] != "completed":
        raise HTTPException(
            status_code=400, detail=f"Report is not ready. Current status: {job['status']}"
        )

    pdf_bytes = job.get("pdf_bytes")

    # CRITICAL: Use dict.pop() to return the bytes AND remove it from memory to prevent leaks
    REPORT_JOBS.pop(job_id, None)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{job_id}.pdf"},
    )


@router.get(
    "/history",
    response_model=list[ReportRead],
    summary="Fetch scheduled report history",
)
async def get_report_history(
    # FIXED: Type hint is User, not dict
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ReportLog).order_by(ReportLog.sent_at.desc()).limit(50)
    result = await db.execute(stmt)
    return result.scalars().all()
