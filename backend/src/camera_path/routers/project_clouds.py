from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from camera_path.routers.contract import MUTATION_ERROR_RESPONSES, set_revision_etag
from camera_path.routers.dependencies import MutationGuard, parse_if_match
from camera_path.services.project_clouds import (
    ProjectCloud,
    ProjectCloudCreate,
    ProjectCloudService,
    ProjectCloudUpdate,
)

router = APIRouter(prefix="/projects/{project_id}/clouds", tags=["Clouds"])


def get_service(request: Request) -> ProjectCloudService:
    return request.app.state.project_cloud_service


Service = Annotated[ProjectCloudService, Depends(get_service)]


@router.get(
    "",
    response_model=list[ProjectCloud],
    operation_id="listProjectClouds",
    summary="List project clouds",
    description="List instances and resolve library download URLs.",
)
async def list_project_clouds(
    project_id: str, request: Request, response: Response, service: Service
) -> list[ProjectCloud]:
    clouds, revision = await service.list(project_id, request)
    set_revision_etag(response, revision)
    return clouds


@router.post(
    "",
    response_model=ProjectCloud,
    status_code=201,
    operation_id="createProjectCloud",
    summary="Add a library cloud",
    description="Attach a ready library asset to the project.",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_project_cloud(
    project_id: str,
    data: ProjectCloudCreate,
    request: Request,
    response: Response,
    service: Service,
    _guard: MutationGuard,
) -> ProjectCloud:
    cloud, revision = await service.add(
        project_id,
        data.library_asset_id,
        data.translation,
        parse_if_match(request.headers["If-Match"]),
        request,
    )
    set_revision_etag(response, revision)
    return cloud


@router.patch(
    "/{cloud_id}",
    response_model=ProjectCloud,
    operation_id="updateProjectCloud",
    summary="Update a project cloud",
    description="Change visibility or ordering of an instance.",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_project_cloud(
    project_id: str,
    cloud_id: str,
    data: ProjectCloudUpdate,
    request: Request,
    response: Response,
    service: Service,
    _guard: MutationGuard,
) -> ProjectCloud:
    cloud, revision = await service.update(
        project_id, cloud_id, data, parse_if_match(request.headers["If-Match"]), request
    )
    set_revision_etag(response, revision)
    return cloud


@router.delete(
    "/{cloud_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteProjectCloud",
    summary="Remove a project cloud",
    description="Detach an instance without deleting its library file.",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_project_cloud(
    project_id: str, cloud_id: str, request: Request, service: Service, _guard: MutationGuard
) -> Response:
    revision = await service.remove(
        project_id, cloud_id, parse_if_match(request.headers["If-Match"])
    )
    return Response(status_code=204, headers={"ETag": f'"{revision}"'})
