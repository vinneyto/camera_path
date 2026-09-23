from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from openai import OpenAIError

from camera_path.agent import AgentUnavailableError
from camera_path.models import (
    AimTimeline,
    Anchor,
    AnchorCreate,
    AnchorUpdate,
    CameraKeyframe,
    CameraKeyframeCreate,
    CameraKeyframeUpdate,
    CameraOrientation,
    CameraOrientationKeyframe,
    CameraOrientationKeyframeCreate,
    CameraOrientationKeyframeUpdate,
    CameraTrackUpdate,
    ChatHistoryMessage,
    ChatMessage,
    ChatResponse,
    CompiledTrajectory,
    DepthOfFieldKeyframe,
    DepthOfFieldKeyframeCreate,
    DepthOfFieldKeyframeUpdate,
    DepthOfFieldTimeline,
    MotionProfile,
    MotionProfileUpdate,
    OrientationTimeline,
    Project,
    ProjectCreate,
    ProjectMetadata,
    ProjectUpdate,
    ScenePoint,
    ScenePointCreate,
    ScenePointUpdate,
    SpeedKeyframe,
    SpeedKeyframeCreate,
    SpeedKeyframeUpdate,
    SpiralSegment,
    SpiralSegmentCreate,
    SplineSegment,
    SplineSegmentCreate,
    Trajectory,
)
from camera_path.repositories import ProjectNotFoundError
from camera_path.routers.contract import (
    ERROR_RESPONSES,
    MUTATION_ERROR_RESPONSES,
    set_revision_etag,
)
from camera_path.routers.dependencies import (
    Agent,
    AnchorServiceDep,
    ChatServiceDep,
    MutationGuard,
    ProjectServiceDep,
    ScenePointServiceDep,
    TimelineServiceDep,
    TrajectoryServiceDep,
)

router = APIRouter()


def _metadata(project: Project) -> ProjectMetadata:
    return ProjectMetadata(id=project.id, name=project.name, revision=project.revision)


def _with_revision(response: Response, project: Project):
    set_revision_etag(response, project.revision)


def _deleted(project: Project) -> Response:
    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers={"ETag": f'"{project.revision}"'},
    )


def _not_found(error: KeyError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(error))


@router.post(
    "/projects",
    response_model=ProjectMetadata,
    status_code=status.HTTP_201_CREATED,
    tags=["Projects"],
    summary="Create a project",
    description="Create an empty project and return only project metadata.",
    operation_id="createProject",
)
async def create_project(
    data: ProjectCreate, service: ProjectServiceDep, response: Response
) -> ProjectMetadata:
    project = await service.create_project(data)
    _with_revision(response, project)
    return _metadata(project)


@router.get(
    "/projects",
    response_model=list[ProjectMetadata],
    tags=["Projects"],
    summary="List projects",
    description="Return project metadata without nested resources.",
    operation_id="listProjects",
)
async def list_projects(service: ProjectServiceDep) -> list[ProjectMetadata]:
    return [_metadata(project) for project in await service.list_projects()]


@router.get(
    "/projects/{project_id}",
    response_model=ProjectMetadata,
    tags=["Projects"],
    summary="Get project metadata",
    description="Return project metadata and its project-level revision ETag.",
    operation_id="getProject",
    responses=ERROR_RESPONSES,
)
async def get_project(
    project_id: str, service: ProjectServiceDep, response: Response
) -> ProjectMetadata:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return _metadata(project)


@router.patch(
    "/projects/{project_id}",
    response_model=ProjectMetadata,
    tags=["Projects"],
    summary="Rename a project",
    description="Rename a project and return the changed metadata resource.",
    operation_id="updateProject",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    service: ProjectServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> ProjectMetadata:
    project = await service.update_project(project_id, data)
    _with_revision(response, project)
    return _metadata(project)


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Projects"],
    summary="Delete a project",
    description="Delete a project and all normalized resources.",
    operation_id="deleteProject",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_project(
    project_id: str, service: ProjectServiceDep, _guard: MutationGuard
) -> Response:
    project = await service.get_project(project_id)
    await service.delete_project(project_id)
    return _deleted(project)


@router.post(
    "/projects/{project_id}/reset",
    response_model=ProjectMetadata,
    tags=["Projects"],
    summary="Reset a project",
    description="Clear resource state while preserving project identity and metadata.",
    operation_id="resetProject",
    responses=MUTATION_ERROR_RESPONSES,
)
async def reset_project(
    project_id: str,
    service: ProjectServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> ProjectMetadata:
    project = await service.reset_project(project_id)
    _with_revision(response, project)
    return _metadata(project)


@router.get(
    "/projects/{project_id}/anchors",
    response_model=list[Anchor],
    tags=["Anchors"],
    summary="List anchors",
    description="Return the project's path anchors.",
    operation_id="listAnchors",
)
async def list_anchors(
    project_id: str, service: ProjectServiceDep, response: Response
) -> list[Anchor]:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return list(project.anchors.values())


@router.post(
    "/projects/{project_id}/anchors",
    response_model=Anchor,
    status_code=status.HTTP_201_CREATED,
    tags=["Anchors"],
    summary="Create an anchor",
    description="Create an anchor and return only the changed resource.",
    operation_id="createAnchor",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_anchor(
    project_id: str,
    data: AnchorCreate,
    service: AnchorServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> Anchor:
    project = await service.add_anchor(project_id, data)
    _with_revision(response, project)
    return next(reversed(project.anchors.values()))


@router.patch(
    "/projects/{project_id}/anchors/{anchor_id}",
    response_model=Anchor,
    tags=["Anchors"],
    summary="Update an anchor",
    description="Update an anchor and return only the changed resource.",
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
) -> Anchor:
    try:
        project = await service.update_anchor(project_id, anchor_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    _with_revision(response, project)
    return project.anchors[anchor_id]


@router.delete(
    "/projects/{project_id}/anchors/{anchor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Anchors"],
    summary="Delete an anchor",
    description="Delete an unreferenced anchor.",
    operation_id="deleteAnchor",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_anchor(
    project_id: str,
    anchor_id: str,
    service: AnchorServiceDep,
    _guard: MutationGuard,
) -> Response:
    try:
        project = await service.delete_anchor(project_id, anchor_id)
    except KeyError as error:
        raise _not_found(error) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return _deleted(project)


@router.get(
    "/projects/{project_id}/scene-points",
    response_model=list[ScenePoint],
    tags=["Scene points"],
    summary="List scene points",
    description="Return named world-space scene points.",
    operation_id="listScenePoints",
)
async def list_scene_points(
    project_id: str, service: ProjectServiceDep, response: Response
) -> list[ScenePoint]:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return list(project.scene_points.values())


@router.post(
    "/projects/{project_id}/scene-points",
    response_model=ScenePoint,
    status_code=status.HTTP_201_CREATED,
    tags=["Scene points"],
    summary="Create a scene point",
    description="Create a scene point and return only the changed resource.",
    operation_id="createScenePoint",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_scene_point(
    project_id: str,
    data: ScenePointCreate,
    service: ScenePointServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> ScenePoint:
    project = await service.add_scene_point(project_id, data)
    _with_revision(response, project)
    return next(reversed(project.scene_points.values()))


@router.patch(
    "/projects/{project_id}/scene-points/{point_id}",
    response_model=ScenePoint,
    tags=["Scene points"],
    summary="Update a scene point",
    description="Update a scene point and return only the changed resource.",
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
) -> ScenePoint:
    try:
        project = await service.update_scene_point(project_id, point_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    _with_revision(response, project)
    return project.scene_points[point_id]


@router.delete(
    "/projects/{project_id}/scene-points/{point_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Scene points"],
    summary="Delete a scene point",
    description="Delete a scene point and optionally its referencing keyframes.",
    operation_id="deleteScenePoint",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_scene_point(
    project_id: str,
    point_id: str,
    service: ScenePointServiceDep,
    _guard: MutationGuard,
    cascade: bool = False,
) -> Response:
    try:
        project = await service.delete_scene_point(project_id, point_id, cascade)
    except KeyError as error:
        raise _not_found(error) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return _deleted(project)


@router.get(
    "/projects/{project_id}/trajectory",
    response_model=Trajectory,
    tags=["Trajectory"],
    summary="Get the editable trajectory",
    description="Return authored trajectory segments; compiled geometry is a separate resource.",
    operation_id="getTrajectory",
)
async def get_trajectory(
    project_id: str, service: ProjectServiceDep, response: Response
) -> Trajectory:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return Trajectory(segments=project.segments)


@router.delete(
    "/projects/{project_id}/trajectory",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Trajectory"],
    summary="Clear the trajectory",
    description="Clear trajectory and timeline resources.",
    operation_id="clearTrajectory",
    responses=MUTATION_ERROR_RESPONSES,
)
async def clear_trajectory(
    project_id: str, service: TrajectoryServiceDep, _guard: MutationGuard
) -> Response:
    return _deleted(await service.clear_trajectory(project_id))


@router.post(
    "/projects/{project_id}/segments/spline",
    response_model=SplineSegment,
    status_code=status.HTTP_201_CREATED,
    tags=["Trajectory"],
    summary="Create a spline segment",
    description="Append a spline segment and return it.",
    operation_id="createSplineSegment",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_spline(
    project_id: str,
    data: SplineSegmentCreate,
    service: TrajectoryServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> SplineSegment:
    project = await service.add_spline(project_id, data)
    _with_revision(response, project)
    return project.segments[-1]


@router.post(
    "/projects/{project_id}/segments/spiral",
    response_model=SpiralSegment,
    status_code=status.HTTP_201_CREATED,
    tags=["Trajectory"],
    summary="Create a spiral segment",
    description="Append a spiral segment and return it.",
    operation_id="createSpiralSegment",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_spiral(
    project_id: str,
    data: SpiralSegmentCreate,
    service: TrajectoryServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> SpiralSegment:
    project = await service.add_spiral(project_id, data)
    _with_revision(response, project)
    return project.segments[-1]


@router.delete(
    "/projects/{project_id}/segments/{segment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Trajectory"],
    summary="Delete a trajectory segment",
    description="Delete one authored segment.",
    operation_id="deleteTrajectorySegment",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_segment(
    project_id: str,
    segment_id: str,
    service: TrajectoryServiceDep,
    _guard: MutationGuard,
) -> Response:
    try:
        return _deleted(await service.delete_segment(project_id, segment_id))
    except KeyError as error:
        raise _not_found(error) from error


@router.get(
    "/projects/{project_id}/trajectory/compiled",
    response_model=CompiledTrajectory,
    tags=["Trajectory"],
    summary="Compile a trajectory",
    description="Return derived playback geometry without persisting it.",
    operation_id="getCompiledTrajectory",
    responses=ERROR_RESPONSES,
)
async def get_compiled_trajectory(
    project_id: str, service: TrajectoryServiceDep, response: Response
) -> CompiledTrajectory:
    compiled = await service.compile(project_id)
    set_revision_etag(response, compiled.revision)
    return compiled


@router.get(
    "/projects/{project_id}/motion",
    response_model=MotionProfile,
    tags=["Timelines"],
    summary="Get the speed timeline",
    description="Return default speed and speed keyframes.",
    operation_id="getSpeedTimeline",
)
async def get_speed_timeline(
    project_id: str, service: ProjectServiceDep, response: Response
) -> MotionProfile:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return project.motion_profile


@router.patch(
    "/projects/{project_id}/motion",
    response_model=MotionProfile,
    tags=["Timelines"],
    summary="Update the speed timeline",
    description="Update default speed and return the changed timeline.",
    operation_id="updateMotionProfile",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_motion_profile(
    project_id: str,
    data: MotionProfileUpdate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> MotionProfile:
    project = await service.update_motion_profile(project_id, data)
    _with_revision(response, project)
    return project.motion_profile


@router.post(
    "/projects/{project_id}/motion/keyframes",
    response_model=SpeedKeyframe,
    status_code=status.HTTP_201_CREATED,
    tags=["Timelines"],
    summary="Create a speed keyframe",
    description="Create and return a speed keyframe.",
    operation_id="createSpeedKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_speed_keyframe(
    project_id: str,
    data: SpeedKeyframeCreate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> SpeedKeyframe:
    project = await service.add_speed_keyframe(project_id, data)
    _with_revision(response, project)
    return next(reversed(project.motion_profile.keyframes.values()))


@router.patch(
    "/projects/{project_id}/motion/keyframes/{keyframe_id}",
    response_model=SpeedKeyframe,
    tags=["Timelines"],
    summary="Update a speed keyframe",
    description="Update and return a speed keyframe.",
    operation_id="updateSpeedKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_speed_keyframe(
    project_id: str,
    keyframe_id: str,
    data: SpeedKeyframeUpdate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> SpeedKeyframe:
    try:
        project = await service.update_speed_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    _with_revision(response, project)
    return project.motion_profile.keyframes[keyframe_id]


@router.delete(
    "/projects/{project_id}/motion/keyframes/{keyframe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Timelines"],
    summary="Delete a speed keyframe",
    description="Delete a speed keyframe.",
    operation_id="deleteSpeedKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_speed_keyframe(
    project_id: str,
    keyframe_id: str,
    service: TimelineServiceDep,
    _guard: MutationGuard,
) -> Response:
    try:
        return _deleted(await service.delete_speed_keyframe(project_id, keyframe_id))
    except KeyError as error:
        raise _not_found(error) from error


def _aim(project: Project) -> AimTimeline:
    return AimTimeline(
        default_aim=project.camera_track.default_aim,
        keyframes=project.camera_track.keyframes,
        world_up=project.camera_track.world_up,
    )


@router.get(
    "/projects/{project_id}/camera",
    response_model=AimTimeline,
    tags=["Timelines"],
    summary="Get the aim timeline",
    description="Return camera aim defaults and keyframes.",
    operation_id="getAimTimeline",
)
async def get_aim_timeline(
    project_id: str, service: ProjectServiceDep, response: Response
) -> AimTimeline:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return _aim(project)


@router.patch(
    "/projects/{project_id}/camera",
    response_model=AimTimeline,
    tags=["Timelines"],
    summary="Update the aim timeline",
    description="Update aim defaults and return the changed timeline.",
    operation_id="updateCameraTrack",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_aim_timeline(
    project_id: str,
    data: CameraTrackUpdate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> AimTimeline:
    project = await service.update_camera_track(project_id, data)
    _with_revision(response, project)
    return _aim(project)


# Remaining aim/orientation/depth-of-field mutations retain their existing paths but return
# the changed keyframe or timeline rather than an aggregate Project.
@router.post(
    "/projects/{project_id}/camera/keyframes",
    response_model=CameraKeyframe,
    status_code=status.HTTP_201_CREATED,
    tags=["Timelines"],
    summary="Create an aim keyframe",
    description="Create and return a camera aim keyframe.",
    operation_id="createCameraAimKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_aim_keyframe(
    project_id: str,
    data: CameraKeyframeCreate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> CameraKeyframe:
    project = await service.add_camera_keyframe(project_id, data)
    _with_revision(response, project)
    return next(reversed(project.camera_track.keyframes.values()))


@router.patch(
    "/projects/{project_id}/camera/keyframes/{keyframe_id}",
    response_model=CameraKeyframe,
    tags=["Timelines"],
    summary="Update an aim keyframe",
    description="Update and return a camera aim keyframe.",
    operation_id="updateCameraAimKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_aim_keyframe(
    project_id: str,
    keyframe_id: str,
    data: CameraKeyframeUpdate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> CameraKeyframe:
    try:
        project = await service.update_camera_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    _with_revision(response, project)
    return project.camera_track.keyframes[keyframe_id]


@router.delete(
    "/projects/{project_id}/camera/keyframes/{keyframe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Timelines"],
    summary="Delete an aim keyframe",
    description="Delete a camera aim keyframe.",
    operation_id="deleteCameraAimKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_aim_keyframe(
    project_id: str,
    keyframe_id: str,
    service: TimelineServiceDep,
    _guard: MutationGuard,
) -> Response:
    try:
        return _deleted(await service.delete_camera_keyframe(project_id, keyframe_id))
    except KeyError as error:
        raise _not_found(error) from error


@router.get(
    "/projects/{project_id}/camera/orientation",
    response_model=OrientationTimeline,
    tags=["Timelines"],
    summary="Get the orientation timeline",
    description="Return default camera orientation and orientation keyframes.",
    operation_id="getOrientationTimeline",
)
async def get_orientation_timeline(
    project_id: str, service: ProjectServiceDep, response: Response
) -> OrientationTimeline:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return OrientationTimeline(
        default_orientation=project.camera_track.default_orientation,
        keyframes=project.camera_track.orientation_keyframes,
    )


@router.patch(
    "/projects/{project_id}/camera/orientation",
    response_model=OrientationTimeline,
    tags=["Timelines"],
    summary="Update default orientation",
    description="Update default orientation and return the changed timeline.",
    operation_id="updateCameraOrientation",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_orientation(
    project_id: str,
    data: CameraOrientation,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> OrientationTimeline:
    project = await service.update_default_camera_orientation(project_id, data)
    _with_revision(response, project)
    return OrientationTimeline(
        default_orientation=project.camera_track.default_orientation,
        keyframes=project.camera_track.orientation_keyframes,
    )


@router.post(
    "/projects/{project_id}/camera/orientation/keyframes",
    response_model=CameraOrientationKeyframe,
    status_code=status.HTTP_201_CREATED,
    tags=["Timelines"],
    summary="Create an orientation keyframe",
    description="Create and return an orientation keyframe.",
    operation_id="createCameraOrientationKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_orientation_keyframe(
    project_id: str,
    data: CameraOrientationKeyframeCreate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> CameraOrientationKeyframe:
    project = await service.add_camera_orientation_keyframe(project_id, data)
    _with_revision(response, project)
    return next(reversed(project.camera_track.orientation_keyframes.values()))


@router.patch(
    "/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}",
    response_model=CameraOrientationKeyframe,
    tags=["Timelines"],
    summary="Update an orientation keyframe",
    description="Update and return an orientation keyframe.",
    operation_id="updateCameraOrientationKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_orientation_keyframe(
    project_id: str,
    keyframe_id: str,
    data: CameraOrientationKeyframeUpdate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> CameraOrientationKeyframe:
    try:
        project = await service.update_camera_orientation_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    _with_revision(response, project)
    return project.camera_track.orientation_keyframes[keyframe_id]


@router.delete(
    "/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Timelines"],
    summary="Delete an orientation keyframe",
    description="Delete a camera orientation keyframe.",
    operation_id="deleteCameraOrientationKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_orientation_keyframe(
    project_id: str,
    keyframe_id: str,
    service: TimelineServiceDep,
    _guard: MutationGuard,
) -> Response:
    try:
        return _deleted(
            await service.delete_camera_orientation_keyframe(project_id, keyframe_id)
        )
    except KeyError as error:
        raise _not_found(error) from error


@router.get(
    "/projects/{project_id}/camera/depth-of-field",
    response_model=DepthOfFieldTimeline,
    tags=["Timelines"],
    summary="Get the depth-of-field timeline",
    description="Return depth-of-field keyframes.",
    operation_id="getDepthOfFieldTimeline",
)
async def get_depth_of_field_timeline(
    project_id: str, service: ProjectServiceDep, response: Response
) -> DepthOfFieldTimeline:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return DepthOfFieldTimeline(keyframes=project.camera_track.depth_of_field_keyframes)


@router.post(
    "/projects/{project_id}/camera/depth-of-field/keyframes",
    response_model=DepthOfFieldKeyframe,
    status_code=status.HTTP_201_CREATED,
    tags=["Timelines"],
    summary="Create a depth-of-field keyframe",
    description="Create and return a depth-of-field keyframe.",
    operation_id="createDepthOfFieldKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_depth_of_field_keyframe(
    project_id: str,
    data: DepthOfFieldKeyframeCreate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> DepthOfFieldKeyframe:
    project = await service.add_depth_of_field_keyframe(project_id, data)
    _with_revision(response, project)
    return next(reversed(project.camera_track.depth_of_field_keyframes.values()))


@router.patch(
    "/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}",
    response_model=DepthOfFieldKeyframe,
    tags=["Timelines"],
    summary="Update a depth-of-field keyframe",
    description="Update and return a depth-of-field keyframe.",
    operation_id="updateDepthOfFieldKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_depth_of_field_keyframe(
    project_id: str,
    keyframe_id: str,
    data: DepthOfFieldKeyframeUpdate,
    service: TimelineServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> DepthOfFieldKeyframe:
    try:
        project = await service.update_depth_of_field_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    _with_revision(response, project)
    return project.camera_track.depth_of_field_keyframes[keyframe_id]


@router.delete(
    "/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Timelines"],
    summary="Delete a depth-of-field keyframe",
    description="Delete a depth-of-field keyframe.",
    operation_id="deleteDepthOfFieldKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_depth_of_field_keyframe(
    project_id: str,
    keyframe_id: str,
    service: TimelineServiceDep,
    _guard: MutationGuard,
) -> Response:
    try:
        return _deleted(await service.delete_depth_of_field_keyframe(project_id, keyframe_id))
    except KeyError as error:
        raise _not_found(error) from error


@router.get(
    "/projects/{project_id}/chat/messages",
    response_model=list[ChatHistoryMessage],
    tags=["Chat"],
    summary="List chat messages",
    description="Return the complete chat history for the first API version.",
    operation_id="listChatMessages",
)
async def list_chat_messages(
    project_id: str, service: ProjectServiceDep, response: Response
) -> list[ChatHistoryMessage]:
    project = await service.get_project(project_id)
    _with_revision(response, project)
    return project.chat_history


@router.post(
    "/projects/{project_id}/chat/user-messages",
    response_model=ChatHistoryMessage,
    status_code=status.HTTP_201_CREATED,
    tags=["Chat"],
    summary="Save a user chat message",
    description="Persist and return one idempotent user message.",
    operation_id="saveUserChatMessage",
    responses=MUTATION_ERROR_RESPONSES,
)
async def save_user_message(
    project_id: str,
    data: ChatMessage,
    service: ChatServiceDep,
    response: Response,
    _guard: MutationGuard,
) -> ChatHistoryMessage:
    project = await service.save_user_message(project_id, data.id, data.message)
    _with_revision(response, project)
    return next(message for message in project.chat_history if message.id == data.id)


@router.delete(
    "/projects/{project_id}/chat",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Chat"],
    summary="Clear chat history",
    description="Delete all chat messages for the project.",
    operation_id="clearProjectChat",
    responses=MUTATION_ERROR_RESPONSES,
)
async def clear_chat(
    project_id: str, service: ChatServiceDep, _guard: MutationGuard
) -> Response:
    return _deleted(await service.clear_chat(project_id))


@router.post(
    "/projects/{project_id}/chat/messages",
    response_model=ChatResponse,
    tags=["Chat"],
    summary="Send a chat message",
    description="Run the agent and return its answer plus derived compiled trajectory.",
    operation_id="createChatMessage",
    responses=MUTATION_ERROR_RESPONSES,
)
async def create_chat_message(
    project_id: str,
    data: ChatMessage,
    agent: Agent,
    response: Response,
    _guard: MutationGuard,
) -> ChatResponse:
    try:
        result = await agent.handle(project_id, data.message, data.id)
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="OpenAI request failed") from error
    set_revision_etag(response, result.project.revision)
    return ChatResponse(answer=result.answer, compiled=result.compiled)


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post(
    "/projects/{project_id}/chat/messages/stream",
    tags=["Chat"],
    summary="Stream a chat response",
    description=(
        "Run the agent as SSE. `delta` events contain text, `result` contains the final answer "
        "and compiled trajectory without a full Project snapshot, and `error` reports failure."
    ),
    operation_id="streamChatMessage",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Server-sent events named delta, result, or error.",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        }
    },
)
async def stream_chat_message(
    project_id: str,
    data: ChatMessage,
    agent: Agent,
    service: ChatServiceDep,
    _guard: MutationGuard,
) -> StreamingResponse:
    await service.save_user_message(project_id, data.id, data.message)
    try:
        agent.ensure_available()
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    async def events() -> AsyncIterator[str]:
        try:
            async for event in agent.handle_stream(project_id, data.message, data.id):
                if event["type"] == "result":
                    result = event["result"]
                    payload = ChatResponse(
                        answer=result.answer, compiled=result.compiled
                    ).model_dump(mode="json")
                else:
                    payload = {"text": event["text"]}
                yield _sse(event["type"], payload)
        except (OpenAIError, ProjectNotFoundError, RuntimeError) as error:
            yield _sse("error", {"code": "stream_error", "detail": str(error)})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
