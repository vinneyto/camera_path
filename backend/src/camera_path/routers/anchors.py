from fastapi import APIRouter, HTTPException, Response

from camera_path.models import AnchorCreate, AnchorUpdate, Project
from camera_path.routers.contract import MUTATION_ERROR_RESPONSES, with_project_etag
from camera_path.routers.dependencies import AnchorServiceDep, MutationGuard

router = APIRouter(tags=["Projects"])


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
    service: AnchorServiceDep,
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
    service: AnchorServiceDep,
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
    service: AnchorServiceDep,
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
