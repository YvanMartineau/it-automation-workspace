import uuid
from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.engine import get_db, AsyncSessionLocal
from models.report_log import ReportLog
from schemas.report import ReportTriggerRequest, ReportTriggerResponse, ReportRead
from security.jwt_handler import get_current_user, get_admin_user
from services.report_service import generate_and_send_report_task
from middleware.audit_middleware import write_audit_log

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post(
    "/trigger",
    response_model=ReportTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger on-demand report generation",
    description="Queues PDF generation and emails the report to recipient_email via BackgroundTask.",
)
async def trigger_report(
    payload: ReportTriggerRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    report_id = uuid.uuid4()
    actor = current_user.get("username", "admin")

    # Record report generation initiation in Audit Log synchronously
    await write_audit_log(
        db=db,
        actor=actor,
        action="report.generate",
        target_type="report",
        target_id=str(report_id),
        payload={"recipient_email": payload.recipient_email},
    )

    # Offload PDF rendering & sending to non-blocking background task
    background_tasks.add_task(
        generate_and_send_report_task,
        report_id=report_id,
        recipient_email=payload.recipient_email,
        triggered_by=actor,
        db_factory=AsyncSessionLocal,
    )

    return ReportTriggerResponse(report_id=report_id, status="queued")


@router.get(
    "/history",
    response_model=List[ReportRead],
    summary="Fetch report history",
    description="Returns the history of the last 50 generated reports.",
)
async def get_report_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ReportLog)
        .order_by(ReportLog.sent_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return reports