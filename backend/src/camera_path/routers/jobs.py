from fastapi import APIRouter, Request

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
    description="Create a draft with server-validated input. Does not start a pipeline.",
)
@authenticated
async def create_job(data: JobCreate, request: Request) -> Job:
    return await request.app.state.job_service.create(data)


@router.get(
    "/{job_id}",
    response_model=Job,
    operation_id="getJob",
    description="Read job completion and its surviving library results.",
)
async def get_job(job_id: str, request: Request) -> Job:
    return await request.app.state.job_service.get(job_id, request)
