from fastapi import APIRouter, Response, status

from camera_path.models import Project, ProjectCreate, ProjectUpdate
from camera_path.routers.contract import (
    ERROR_RESPONSES,
    MUTATION_ERROR_RESPONSES,
    with_project_etag,
)
from camera_path.routers.dependencies import MutationGuard, ProjectServiceDep

router = APIRouter(tags=["Projects"])


@router.post(
    "/projects",
    response_model=Project,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
    description="Create an empty camera-path project.",
    operation_id="createProject",
    responses={422: ERROR_RESPONSES[422]},
)
async def create_project(
    data: ProjectCreate, service: ProjectServiceDep, response: Response
) -> Project:
    return with_project_etag(response, await service.create_project(data))


@router.get(
    "/projects",
    response_model=list[Project],
    summary="List projects",
    description="Return the current snapshot of every project.",
    operation_id="listProjects",
)
async def list_projects(service: ProjectServiceDep) -> list[Project]:
    return await service.list_projects()


@router.get(
    "/projects/{project_id}",
    response_model=Project,
    summary="Get a project",
    description="Return the current project snapshot and its revision ETag.",
    operation_id="getProject",
    responses=ERROR_RESPONSES,
)
async def get_project(project_id: str, service: ProjectServiceDep, response: Response) -> Project:
    return with_project_etag(response, await service.get_project(project_id))


@router.patch(
    "/projects/{project_id}",
    response_model=Project,
    summary="Rename a project",
    description="Change a project name using optimistic concurrency.",
    operation_id="updateProject",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    service: ProjectServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.update_project(project_id, data))


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
    description="Delete a project and all of its snapshots.",
    operation_id="deleteProject",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_project(
    project_id: str, service: ProjectServiceDep, _guard: MutationGuard
) -> Response:
    await service.delete_project(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/projects/{project_id}/reset",
    response_model=Project,
    summary="Reset a project",
    description="Clear scene, trajectory, and chat state while preserving project identity.",
    operation_id="resetProject",
    responses=MUTATION_ERROR_RESPONSES,
)
async def reset_project(
    project_id: str,
    service: ProjectServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.reset_project(project_id))
