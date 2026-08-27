"""
routers/scan.py

POST /scan                   — start an async subnet scan (admin only)
GET  /scan/{job_id}/stream   — SSE stream of scan progress (any authenticated user)

Route handlers stay thin per elite standard #4: validate input, delegate to
services/scanner.py, write the audit trail, return. No scanning logic lives
here.
"""

import asyncio
import json
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from db.engine import AsyncSessionLocal, get_db
from models.user import User
from schemas.scan import ScanRequest, ScanStartResponse
from security.jwt_handler import get_admin_user, get_current_user
from security.rate_limiter import limiter
from services import scanner
from middleware.audit_middleware import write_audit_log

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scan", tags=["scan"])

# How long the SSE generator waits on an empty queue before sending a
# keep-alive comment and re-checking whether the client is still attached.
# Without this, a client that vanishes mid-scan (or a scan that stalls
# indefinitely) leaves the generator awaiting queue.get() forever.
_SSE_HEARTBEAT_SECONDS = 15


@router.post(
    "",
    response_model=ScanStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a subnet scan",
    description=(
        "Validates the subnet is a private RFC 1918 range, registers a scan job, "
        "and schedules it as a background task. Returns immediately with a job_id — "
        "use GET /scan/{job_id}/stream to follow progress. Admin role required."
    ),
)
@limiter.limit("10/minute")
async def start_scan(
    request: Request,
    scan_request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> ScanStartResponse:
    job_id = uuid4()
    scanner.create_job(job_id, scan_request.subnet)

    # Written synchronously on the request's own db session — this call is
    # still inside request scope, unlike run_scan() below which executes
    # after the response has already been sent. write_audit_log() never
    # raises (see services/audit_log_service.py), so no extra try/except
    # is needed here to keep this handler thin.
    await write_audit_log(
        db=db,
        actor=current_user.email,
        action="device.scan.start",
        target_type="scan_job",
        target_id=str(job_id),
        payload={"subnet": scan_request.subnet},
    )

    background_tasks.add_task(
        scanner.run_scan,
        job_id=job_id,
        subnet=scan_request.subnet,
        actor=current_user.email,
        session_factory=AsyncSessionLocal,
    )

    return ScanStartResponse(job_id=job_id, status="started")


@router.get(
    "/{job_id}/stream",
    summary="Stream scan progress via SSE",
    description=(
        "Server-Sent Events stream of a running scan job's progress. Emits "
        "'progress' events per host, then a terminal 'complete' or 'error' "
        "event, after which the stream closes. Any authenticated user may watch."
    ),
)
async def stream_scan_progress(
    job_id: UUID,
    request: Request,
    current_user: User = Depends(get_admin_user),
) -> EventSourceResponse:
    job = scanner.get_job(str(job_id))
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No scan job found with id {job_id}",
        )

    async def event_generator():
        queue = job["queue"]
        while True:
            if await request.is_disconnected():
                logger.info("Client disconnected from scan stream %s", job_id)
                break

            try:
                event = await asyncio.wait_for(queue.get(), timeout=_SSE_HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                # A raw comment line (":keep-alive") — browsers' EventSource
                # ignores it, but it keeps Nginx (proxy_read_timeout) and
                # Cloudflare Tunnel from treating the connection as idle.
                yield {"comment": "keep-alive"}
                continue

            yield {
                "event": event["event"],
                "data": json.dumps(event["data"]),
            }

            if event["event"] in ("complete", "error"):
                break

    return EventSourceResponse(event_generator())