"""
In-memory job status store with a per-job SSE queue. Generic — usable by
any long-running background operation that needs to report real progress,
not just onboarding. Scanner should use this too once built, rather than
duplicating the pattern.

In-memory by design: job state doesn't need to survive a restart, and this
is a single-instance demo, not a multi-worker deployment. If this ever runs
with multiple workers, this needs to move to Redis or similar.
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass
class Job:
    job_id: str
    status: str
    data: dict[str, Any] = field(default_factory=dict)
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)


_jobs: dict[str, Job] = {}


def create_job(initial_status: str = "PENDING") -> Job:
    job = Job(job_id=str(uuid.uuid4()), status=initial_status)
    _jobs[job.job_id] = job
    return job


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


async def update_job_status(job_id: str, status: str, data: dict[str, Any] | None = None) -> None:
    job = _jobs.get(job_id)
    if job is None:
        return
    job.status = status
    job.updated_at = datetime.now(UTC)
    if data:
        job.data.update(data)  # merge, never replace — see note below on temporary_password
    await job.queue.put(
        {"status": status, "data": job.data, "updated_at": job.updated_at.isoformat()}
    )
