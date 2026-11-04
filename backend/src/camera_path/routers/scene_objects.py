from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.routers.contract import MUTATION_ERROR_RESPONSES, set_revision_etag
from camera_path.routers.dependencies import MutationGuard, parse_if_match
from camera_path.services.scene_objects import (
    SceneObject,
    SceneObjectCreate,
    SceneObjectService,
    SceneObjectUpdate,
)

router = APIRouter(
    route_class=AuthenticatedRoute,
    prefix="/projects/{project_id}/scene-objects",
    tags=["Scene objects"],
)


def get_service(request: Request) -> SceneObjectService:
    return request.app.state.scene_object_service


Service = Annotated[SceneObjectService, Depends(get_service)]


@router.get(
    "",
    response_model=list[SceneObject],
    operation_id="listSceneObjects",
    summary="List scene objects",
    description="List instances and resolve library download URLs.",
)
async def list_scene_objects(
    project_id: str, request: Request, response: Response, service: Service
) -> list[SceneObject]:
    clouds, revision = await service.list(project_id, request)
    set_revision_etag(response, revision)
    return clouds


@router.post(
    "",
    response_model=SceneObject,
    status_code=201,
    operation_id="createSceneObject",
    summary="Add a scene object",
    description="Attach a ready library asset to the project.",
    responses=MUTATION_ERROR_RESPONSES,
)
@authenticated
async def create_scene_object(
    project_id: str,
    data: SceneObjectCreate,
    request: Request,
    response: Response,
    service: Service,
    _guard: MutationGuard,
) -> SceneObject:
    cloud, revision = await service.add(
        project_id,
        data,
        parse_if_match(request.headers["If-Match"]),
        request,
    )
    set_revision_etag(response, revision)
    return cloud


@router.patch(
    "/{object_id}",
    response_model=SceneObject,
    operation_id="updateSceneObject",
    summary="Update a scene object",
    description="Change local transform, parent, visibility or ordering of a scene object.",
    responses=MUTATION_ERROR_RESPONSES,
)
@authenticated
async def update_scene_object(
    project_id: str,
    object_id: str,
    data: SceneObjectUpdate,
    request: Request,
    response: Response,
    service: Service,
    _guard: MutationGuard,
) -> SceneObject:
    cloud, revision = await service.update(
        project_id, object_id, data, parse_if_match(request.headers["If-Match"]), request
    )
    set_revision_etag(response, revision)
    return cloud


@router.delete(
    "/{object_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteSceneObject",
    summary="Remove a scene object",
    description="Detach an instance without deleting its library file.",
    responses=MUTATION_ERROR_RESPONSES,
)
@authenticated
async def delete_scene_object(
    project_id: str, object_id: str, request: Request, service: Service, _guard: MutationGuard
) -> Response:
    revision = await service.remove(
        project_id, object_id, parse_if_match(request.headers["If-Match"])
    )
    return Response(status_code=204, headers={"ETag": f'"{revision}"'})
