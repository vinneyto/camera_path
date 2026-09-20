from fastapi import APIRouter, HTTPException, Response

from camera_path.models import CompiledTrajectory, Project, SpiralSegmentCreate, SplineSegmentCreate
from camera_path.routers.contract import (
    ERROR_RESPONSES,
    MUTATION_ERROR_RESPONSES,
    set_revision_etag,
    with_project_etag,
)
from camera_path.routers.dependencies import MutationGuard, TrajectoryServiceDep

router = APIRouter(tags=["Trajectory"])


@router.delete(
    "/projects/{project_id}/trajectory",
    response_model=Project,
    summary="Clear a trajectory",
    description="Remove trajectory segments and control keyframes while preserving scene setup.",
    operation_id="clearTrajectory",
    responses=MUTATION_ERROR_RESPONSES,
)
async def clear_trajectory(
    project_id: str, service: TrajectoryServiceDep, response: Response, _guard: MutationGuard
) -> Project:
    return with_project_etag(response, await service.clear_trajectory(project_id))


@router.post(
    "/projects/{project_id}/segments/spline",
    response_model=Project,
    summary="Add a spline segment",
    description="Append a Catmull–Rom-derived spline segment.",
    operation_id="createSplineSegment",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_spline(
    project_id: str,
    data: SplineSegmentCreate,
    service: TrajectoryServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.add_spline(project_id, data))


@router.post(
    "/projects/{project_id}/segments/spiral",
    response_model=Project,
    summary="Add a spiral segment",
    description="Append a semantic spiral segment.",
    operation_id="createSpiralSegment",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_spiral(
    project_id: str,
    data: SpiralSegmentCreate,
    service: TrajectoryServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.add_spiral(project_id, data))


@router.delete(
    "/projects/{project_id}/segments/{segment_id}",
    response_model=Project,
    summary="Delete a segment",
    description="Delete one authored trajectory segment.",
    operation_id="deleteTrajectorySegment",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_segment(
    project_id: str,
    segment_id: str,
    service: TrajectoryServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.delete_segment(project_id, segment_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return with_project_etag(response, project)


@router.get(
    "/projects/{project_id}/trajectory/compiled",
    response_model=CompiledTrajectory,
    summary="Compile a trajectory",
    description="Compile the current semantic project snapshot for runtime playback.",
    operation_id="getCompiledTrajectory",
    responses=ERROR_RESPONSES,
)
async def compiled_trajectory(
    project_id: str, service: TrajectoryServiceDep, response: Response
) -> CompiledTrajectory:
    compiled = await service.compile(project_id)
    set_revision_etag(response, compiled.revision)
    return compiled
