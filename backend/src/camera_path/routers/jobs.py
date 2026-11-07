import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from camera_path.persistence.enums import JobStatus
from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.services.jobs import Job, JobCreate, JobSummary

router = APIRouter(prefix="/jobs", tags=["Jobs"], route_class=AuthenticatedRoute)


@router.get(
    "",
    response_model=list[JobSummary],
    operation_id="listJobs",
    description="List all job types, newest first, with status, prompt, errors and result links.",
)
async def list_jobs(request: Request) -> list[JobSummary]:
    return await request.app.state.job_service.list()


@router.post(
    "",
    response_model=Job,
    status_code=201,
    operation_id="createJob",
    description="Create a draft, or queue it for generation when start is true.",
)
@authenticated
async def create_job(data: JobCreate, request: Request) -> Job:
    return await request.app.state.job_service.create(data, request)


@router.get(
    "/{job_id}",
    response_model=Job,
    operation_id="getJob",
    description="Read job completion and its surviving library results.",
)
async def get_job(job_id: str, request: Request) -> Job:
    return await request.app.state.job_service.get(job_id, request)


@router.get(
    "/{job_id}/events",
    operation_id="streamJobStatus",
    description="Stream job status changes until the job leaves the active queue.",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {"schema": {"type": "string"}}}}},
)
async def stream_job_status(job_id: str, request: Request) -> StreamingResponse:
    service = request.app.state.job_service
    job = await service.get(job_id, request)

    async def events():
        status, previous = job.status, None
        idle = 0
        while status is not None:
            if status != previous:
                yield f"event: job-status\ndata: {json.dumps({'status': status})}\n\n"
                previous, idle = status, 0
            elif idle >= 15:
                yield ": keepalive\n\n"
                idle = 0
            if status not in (JobStatus.QUEUED, JobStatus.RUNNING):
                return
            await asyncio.sleep(1)
            status = await service.status(job.id)
            idle += 1

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
