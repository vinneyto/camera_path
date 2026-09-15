from fastapi import APIRouter, HTTPException, Response, status

from camera_path.models import (
    AnchorCreate,
    AnchorUpdate,
    Project,
    ProjectCreate,
    ProjectUpdate,
    ScenePointCreate,
    ScenePointUpdate,
)
from camera_path.routers.contract import (
    ERROR_RESPONSES,
    MUTATION_ERROR_RESPONSES,
    with_project_etag,
)
from camera_path.routers.dependencies import MutationGuard, Service

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
async def create_project(data: ProjectCreate, service: Service, response: Response) -> Project:
    return with_project_etag(response, await service.create_project(data))


@router.get(
    "/projects",
    response_model=list[Project],
    summary="List projects",
    description="Return the current snapshot of every project.",
    operation_id="listProjects",
)
async def list_projects(service: Service) -> list[Project]:
    return await service.list_projects()


@router.get(
    "/projects/{project_id}",
    response_model=Project,
    summary="Get a project",
    description="Return the current project snapshot and its revision ETag.",
    operation_id="getProject",
    responses=ERROR_RESPONSES,
)
async def get_project(project_id: str, service: Service, response: Response) -> Project:
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
    service: Service,
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
async def delete_project(project_id: str, service: Service, _guard: MutationGuard) -> Response:
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
    project_id: str, service: Service, response: Response, _guard: MutationGuard
) -> Project:
    return with_project_etag(response, await service.reset_project(project_id))


@router.post(
    "/projects/{project_id}/anchors",
    response_model=Project,
    summary="Add an anchor",
    description="Add a lifted surface anchor to the project.",
    operation_id="createAnchor",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_anchor(
    project_id: str,
    data: AnchorCreate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.add_anchor(project_id, data))


@router.patch(
    "/projects/{project_id}/anchors/{anchor_id}",
    response_model=Project,
    summary="Update an anchor",
    description="Update an existing path anchor.",
    operation_id="updateAnchor",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_anchor(
    project_id: str,
    anchor_id: str,
    data: AnchorUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.update_anchor(project_id, anchor_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return with_project_etag(response, project)


@router.delete(
    "/projects/{project_id}/anchors/{anchor_id}",
    response_model=Project,
    summary="Delete an anchor",
    description="Delete an unreferenced path anchor.",
    operation_id="deleteAnchor",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_anchor(
    project_id: str,
    anchor_id: str,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.delete_anchor(project_id, anchor_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return with_project_etag(response, project)


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
    service: Service,
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
    service: Service,
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
    service: Service,
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
