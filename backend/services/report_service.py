import logging
import uuid
from typing import Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.report_log import ReportLog, ReportStatus, ReportType
from models.device import Device
from models.audit_log import AuditLog
from services.pdf_service import generate_report_pdf
from services.email_service import send_email_with_attachment
from middleware.audit_middleware import write_audit_log

logger = logging.getLogger(__name__)


async def generate_and_send_report_task(
    report_id: uuid.UUID,
    recipient_email: str,
    triggered_by: str,
    db_factory: Callable[[], AsyncSession],
    report_type: str = ReportType.MANUAL,
) -> None:
    """
    Gathers metrics, renders PDF, and sends an email report in a non-blocking background process.
    """
    async with db_factory() as db:
        try:
            # --- HIGH SIGNAL METRICS COLLECTION ---
            
            # Fleet Health Metrics
            total_devices = (await db.execute(select(func.count(Device.id)))).scalar_one_or_none() or 0
            online_devices = (await db.execute(
                select(func.count(Device.id)).where(Device.status == "online")
            )).scalar_one_or_none() or 0

            offline_devices = (await db.execute(
                select(Device).where(Device.status == "offline")
            )).scalars().all()

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

            # Compliance & Security Audit Activity (Last 24 hours)
            audit_events_count = (await db.execute(
                select(func.count(AuditLog.id))
            )).scalar_one_or_none() or 0

            context = {
                "report_type": report_type,
                "total_devices": total_devices,
                "online_devices": online_devices,
                "offline_devices": offline_devices,
                "top_cpu_devices": top_cpu_devices,
                "high_memory_devices": high_memory_devices,
                "avg_latency_ms": round(avg_latency, 2),
                "total_audit_events_24h": audit_events_count,
            }

            # --- GENERATION AND DELIVERY ---
            pdf_bytes = await generate_report_pdf(context)

            await send_email_with_attachment(
                to_email=recipient_email,
                subject=f"[{report_type.upper()}] IT Automation Infrastructure Report",
                body=f"Hello,\n\nPlease find attached the requested infrastructure report ({report_type}).\n\nAutomated Systems Engine",
                attachment_bytes=pdf_bytes,
                filename=f"infrastructure_report_{report_type}.pdf",
            )

            # --- DB & AUDIT UPDATE ---
            report_entry = ReportLog(
                id=report_id,
                report_type=report_type,
                triggered_by=triggered_by,
                recipient_email=recipient_email,
                status=ReportStatus.SENT,
            )
            db.add(report_entry)
            await db.commit()

            await write_audit_log(
                db=db,
                actor=triggered_by,
                action="report.send",
                target_type="report",
                target_id=str(report_id),
                payload={"recipient": recipient_email, "report_type": report_type},
            )

        except Exception as exc:
            logger.error(f"Failed to process report job {report_id}: {exc}", exc_info=True)
            await db.rollback()

            failed_entry = ReportLog(
                id=report_id,
                report_type=report_type,
                triggered_by=triggered_by,
                recipient_email=recipient_email,
                status=ReportStatus.FAILED,
                error_message=str(exc),
            )
            db.add(failed_entry)
            await db.commit()