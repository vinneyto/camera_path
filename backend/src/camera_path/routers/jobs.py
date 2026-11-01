from fastapi import APIRouter, Request

from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.services.jobs import Job

router = APIRouter(prefix="/jobs", tags=["Jobs"], route_class=AuthenticatedRoute)


@router.post(
    "",
    response_model=Job,
    status_code=201,
    operation_id="createJob",
    description="Reserve an empty job without starting a generator.",
)
@authenticated
async def create_job(request: Request) -> Job:
    return await request.app.state.job_service.create()


@router.get(
    "/{job_id}",
    response_model=Job,
    operation_id="getJob",
    description="Read job completion and its surviving library results.",
)
async def get_job(job_id: str, request: Request) -> Job:
    return await request.app.state.job_service.get(job_id, request)
