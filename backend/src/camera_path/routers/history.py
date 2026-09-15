from fastapi import APIRouter, Response

from camera_path.models import Project
from camera_path.routers.contract import MUTATION_ERROR_RESPONSES, with_project_etag
from camera_path.routers.dependencies import MutationGuard, Service

router = APIRouter(tags=["History"])


@router.post(
    "/projects/{project_id}/undo",
    response_model=Project,
    summary="Undo the latest change",
    description="Move the project history cursor to the preceding snapshot.",
    operation_id="undoProjectChange",
    responses=MUTATION_ERROR_RESPONSES,
)
async def undo(
    project_id: str, service: Service, response: Response, _guard: MutationGuard
) -> Project:
    return with_project_etag(response, await service.undo(project_id))


@router.post(
    "/projects/{project_id}/redo",
    response_model=Project,
    summary="Redo the next change",
    description="Move the project history cursor to the following snapshot.",
    operation_id="redoProjectChange",
    responses=MUTATION_ERROR_RESPONSES,
)
async def redo(
    project_id: str, service: Service, response: Response, _guard: MutationGuard
) -> Project:
    return with_project_etag(response, await service.redo(project_id))
