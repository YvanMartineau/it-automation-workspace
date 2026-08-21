import logging
import uuid
from datetime import datetime, timezone
from typing import Callable, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.report_log import ReportLog, ReportStatus, ReportType
from models.device import Device
from models.audit_log import AuditLog
from models.onboarded_user import OnboardedUser
from services.pdf_service import generate_report_pdf
from services.email_service import send_email_with_attachment
from middleware.audit_middleware import write_audit_log

logger = logging.getLogger(__name__)

# In-memory store for manual PDF generation jobs (cleared upon download)
REPORT_JOBS: dict[uuid.UUID, dict] = {}

async def _gather_report_metrics(
    db: AsyncSession, 
    report_type: str, 
    start_date: Optional[datetime] = None, 
    end_date: Optional[datetime] = None
) -> dict:
    """Gathers cross-table high-signal metrics dynamically based on report type and date ranges."""
    # --- HIGH SIGNAL METRICS COLLECTION ---
    # 1. Device Health & Inventory (Always useful context)
    # Fleet Health Metrics
    total_devices = (await db.execute(select(func.count(Device.id)))).scalar_one_or_none() or 0
    online_devices = (await db.execute(select(func.count(Device.id)).where(Device.status == "online"))).scalar_one_or_none() or 0
    offline_devices = (await db.execute(select(Device).where(Device.status == "offline"))).scalars().all()

    # Infrastructure Load Metrics
    top_cpu_devices = (await db.execute(
        select(Device).order_by(Device.cpu_percent.desc().nullslast()).limit(5)
    )).scalars().all()

    high_memory_devices = (await db.execute(
        select(Device).where(Device.memory_percent > 85.0).limit(5)
    )).scalars().all()

    avg_latency = (await db.execute(
        select(func.avg(Device.latency_ms)).where(Device.status == "online")
    )).scalar_one_or_none() or 0.0

    # 2. Onboarding Workflow Summary (Filtered by dates if provided)
    onboard_stmt = select(func.count(OnboardedUser.id))
    if start_date: onboard_stmt = onboard_stmt.where(OnboardedUser.created_at >= start_date)
    if end_date: onboard_stmt = onboard_stmt.where(OnboardedUser.created_at <= end_date)
    total_onboarded = (await db.execute(onboard_stmt)).scalar_one_or_none() or 0


    # Compliance & Security Audit Activity (Last 24 hours)
    # 3. Compliance & Audit Logs (Filtered by dates if provided)
    audit_stmt = select(func.count(AuditLog.id))
    if start_date: audit_stmt = audit_stmt.where(AuditLog.timestamp >= start_date)
    if end_date: audit_stmt = audit_stmt.where(AuditLog.timestamp <= end_date)
    audit_events_count = (await db.execute(audit_stmt)).scalar_one_or_none() or 0


    return {
        "report_type": report_type,
        "total_devices": total_devices,
        "online_devices": online_devices,
        "offline_devices": offline_devices,
        "top_cpu_devices": top_cpu_devices,
        "high_memory_devices": high_memory_devices,
        "avg_latency_ms": round(avg_latency, 2),
        "total_onboarded_users": total_onboarded,
        "total_audit_events_24h": audit_events_count, # Reusing template variable name
        "start_date": start_date.isoformat() if start_date else "Beginning of Time",
        "end_date": end_date.isoformat() if end_date else "Present",
    }


async def generate_manual_report_task(
    job_id: uuid.UUID,
    report_name: str,             # Added parameter
    report_type: str,
    actor: str,
    recipient_email: str,        # Added parameter
    db_factory: Callable[[], AsyncSession],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> None:
    """Non-blocking BackgroundTask for generating a manual PDF."""
    REPORT_JOBS[job_id]["status"] = "running"
    
    async with db_factory() as db:
        try:
            # 1. Gather Data
            context = await _gather_report_metrics(db, report_type, start_date, end_date)
            
            # 2. Render PDF
            pdf_bytes = await generate_report_pdf(context)
            
            # 3. Store Result in memory for download
            REPORT_JOBS[job_id]["status"] = "completed"
            REPORT_JOBS[job_id]["pdf_bytes"] = pdf_bytes
            
            # 4. Store in Report Table (History)
            report_record = ReportLog(
                id=job_id,
                report_name=report_name,
                report_type=report_type,
                triggered_by=actor,
                recipient_email=recipient_email,
                status="SENT",
                sent_at=datetime.now(timezone.utc)
            )
            db.add(report_record)
            
            # 5. Audit Log
            await write_audit_log(
                db=db, 
                actor=actor, 
                action="report.generate_manual", 
                target_type="report",
                target_id=str(job_id), 
                payload={"report_type": report_type}
            )
            
            # CRITICAL: Commit the transaction to save both the log and audit entries
            await db.commit()
            
        except Exception as exc:
            logger.error(f"Manual report generation failed for {job_id}: {exc}", exc_info=True)
            REPORT_JOBS[job_id]["status"] = "FAILED"
            REPORT_JOBS[job_id]["error_message"] = str(exc)
            
            # Attempt to record the failure in the database history
            try:
                failed_record = ReportLog(
                    id=job_id,
                    report_name=report_name,
                    report_type=report_type,
                    triggered_by=actor,
                    recipient_email=recipient_email,
                    status="FAILED",
                    sent_at=datetime.now(timezone.utc),
                    error_message=str(exc)
                )
                db.add(failed_record)
                await db.commit()
            except Exception as inner_exc:
                logger.error(f"Failed to record failed report state to DB: {inner_exc}")


async def generate_and_send_report_task(
    report_id: uuid.UUID,
    recipient_email: str,
    triggered_by: str,
    db_factory: Callable[[], AsyncSession],
    report_type: ReportType,
) -> None:
    """Triggered by APScheduler. Generates Overview and sends via email."""
    async with db_factory() as db:
        try:
            # Gather generic overview metrics for the weekly report
            context = await _gather_report_metrics(db, report_type="overview")
            pdf_bytes = await generate_report_pdf(context)
            
            await send_email_with_attachment(
                to_email=recipient_email,
                subject="[WEEKLY OVERVIEW] IT Automation Infrastructure Report",
                body="Hello,\n\nPlease find attached your weekly automated infrastructure report.\n\nAutomated Systems Engine",
                attachment_bytes=pdf_bytes,
                filename="weekly_infrastructure_report.pdf",
            )
            
            report_entry = ReportLog(
                id=report_id,
                report_type=report_type.value,
                triggered_by=triggered_by,
                recipient_email=recipient_email,
                status=ReportStatus.SENT,
            )
            db.add(report_entry)
            await db.commit()
            
            await write_audit_log(
                db=db, actor=triggered_by, action="report.send_weekly", target_type="report",
                target_id=str(report_id), payload={"recipient": recipient_email}
            )
            
        except Exception as exc:
            logger.error(f"Scheduled report failed: {exc}", exc_info=True)
            await db.rollback()
            failed_entry = ReportLog(
                id=report_id, report_type=report_type.value, triggered_by=triggered_by,
                recipient_email=recipient_email, status=ReportStatus.FAILED, error_message=str(exc),
            )
            db.add(failed_entry)
            await db.commit()