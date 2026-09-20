from fastapi import APIRouter, HTTPException, Response

from camera_path.models import Project, ScenePointCreate, ScenePointUpdate
from camera_path.routers.contract import MUTATION_ERROR_RESPONSES, with_project_etag
from camera_path.routers.dependencies import MutationGuard, ScenePointServiceDep

router = APIRouter(tags=["Projects"])


@router.post(
    "/projects/{project_id}/scene-points",
    response_model=Project,
    summary="Add a scene point",
    description="Add a named world-space point that camera controls can reference.",
    operation_id="createScenePoint",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_scene_point(
    project_id: str,
    data: ScenePointCreate,
    service: ScenePointServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.add_scene_point(project_id, data))


@router.patch(
    "/projects/{project_id}/scene-points/{point_id}",
    response_model=Project,
    summary="Update a scene point",
    description="Update a named world-space point.",
    operation_id="updateScenePoint",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_scene_point(
    project_id: str,
    point_id: str,
    data: ScenePointUpdate,
    service: ScenePointServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.update_scene_point(project_id, point_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return with_project_etag(response, project)


@router.delete(
    "/projects/{project_id}/scene-points/{point_id}",
    response_model=Project,
    summary="Delete a scene point",
    description="Delete a scene point, optionally cascading to controls that reference it.",
    operation_id="deleteScenePoint",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_scene_point(
    project_id: str,
    point_id: str,
    service: ScenePointServiceDep,
    response: Response,
    _guard: MutationGuard,
    cascade: bool = False,
) -> Project:
    try:
        project = await service.delete_scene_point(project_id, point_id, cascade)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return with_project_etag(response, project)
