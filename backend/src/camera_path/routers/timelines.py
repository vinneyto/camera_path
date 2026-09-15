from fastapi import APIRouter, HTTPException, Response

from camera_path.models import (
    CameraKeyframeCreate,
    CameraKeyframeUpdate,
    CameraOrientation,
    CameraOrientationKeyframeCreate,
    CameraOrientationKeyframeUpdate,
    CameraTrackUpdate,
    DepthOfFieldKeyframeCreate,
    DepthOfFieldKeyframeUpdate,
    MotionProfileUpdate,
    Project,
    SpeedKeyframeCreate,
    SpeedKeyframeUpdate,
)
from camera_path.routers.contract import MUTATION_ERROR_RESPONSES, with_project_etag
from camera_path.routers.dependencies import MutationGuard, Service

router = APIRouter(tags=["Timelines"])


def _not_found(error: KeyError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(error))


@router.patch(
    "/projects/{project_id}/motion",
    response_model=Project,
    summary="Update the motion profile",
    description="Set the default playback speed.",
    operation_id="updateMotionProfile",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_motion_profile(
    project_id: str,
    data: MotionProfileUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.update_motion_profile(project_id, data))


@router.post(
    "/projects/{project_id}/motion/keyframes",
    response_model=Project,
    summary="Add a speed keyframe",
    description="Add a keyframe to the speed timeline.",
    operation_id="createSpeedKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_speed_keyframe(
    project_id: str,
    data: SpeedKeyframeCreate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.add_speed_keyframe(project_id, data))


@router.patch(
    "/projects/{project_id}/motion/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Update a speed keyframe",
    description="Update a keyframe on the speed timeline.",
    operation_id="updateSpeedKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_speed_keyframe(
    project_id: str,
    keyframe_id: str,
    data: SpeedKeyframeUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.update_speed_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.delete(
    "/projects/{project_id}/motion/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Delete a speed keyframe",
    description="Delete a keyframe from the speed timeline.",
    operation_id="deleteSpeedKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_speed_keyframe(
    project_id: str,
    keyframe_id: str,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.delete_speed_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.patch(
    "/projects/{project_id}/camera",
    response_model=Project,
    summary="Update the camera aim track",
    description="Set default camera aim and world-up values.",
    operation_id="updateCameraTrack",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_camera_track(
    project_id: str,
    data: CameraTrackUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.update_camera_track(project_id, data))


@router.post(
    "/projects/{project_id}/camera/keyframes",
    response_model=Project,
    summary="Add a camera aim keyframe",
    description="Add a keyframe to the camera aim timeline.",
    operation_id="createCameraAimKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_camera_keyframe(
    project_id: str,
    data: CameraKeyframeCreate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    return with_project_etag(response, await service.add_camera_keyframe(project_id, data))


@router.patch(
    "/projects/{project_id}/camera/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Update a camera aim keyframe",
    description="Update a keyframe on the camera aim timeline.",
    operation_id="updateCameraAimKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_camera_keyframe(
    project_id: str,
    keyframe_id: str,
    data: CameraKeyframeUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.update_camera_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.delete(
    "/projects/{project_id}/camera/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Delete a camera aim keyframe",
    description="Delete a keyframe from the camera aim timeline.",
    operation_id="deleteCameraAimKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_camera_keyframe(
    project_id: str,
    keyframe_id: str,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.delete_camera_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.patch(
    "/projects/{project_id}/camera/orientation",
    response_model=Project,
    summary="Update default camera orientation",
    description="Set the default local yaw, pitch, and roll offsets.",
    operation_id="updateCameraOrientation",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_default_camera_orientation(
    project_id: str,
    data: CameraOrientation,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    project = await service.update_default_camera_orientation(project_id, data)
    return with_project_etag(response, project)


@router.post(
    "/projects/{project_id}/camera/orientation/keyframes",
    response_model=Project,
    summary="Add an orientation keyframe",
    description="Add a keyframe to the local camera orientation timeline.",
    operation_id="createCameraOrientationKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_camera_orientation_keyframe(
    project_id: str,
    data: CameraOrientationKeyframeCreate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    project = await service.add_camera_orientation_keyframe(project_id, data)
    return with_project_etag(response, project)


@router.patch(
    "/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Update an orientation keyframe",
    description="Update a keyframe on the local camera orientation timeline.",
    operation_id="updateCameraOrientationKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_camera_orientation_keyframe(
    project_id: str,
    keyframe_id: str,
    data: CameraOrientationKeyframeUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.update_camera_orientation_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.delete(
    "/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Delete an orientation keyframe",
    description="Delete a keyframe from the local camera orientation timeline.",
    operation_id="deleteCameraOrientationKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_camera_orientation_keyframe(
    project_id: str,
    keyframe_id: str,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.delete_camera_orientation_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.post(
    "/projects/{project_id}/camera/depth-of-field/keyframes",
    response_model=Project,
    summary="Add a depth-of-field keyframe",
    description="Add a focus target and lens parameters to the depth-of-field timeline.",
    operation_id="createDepthOfFieldKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def add_depth_of_field_keyframe(
    project_id: str,
    data: DepthOfFieldKeyframeCreate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    project = await service.add_depth_of_field_keyframe(project_id, data)
    return with_project_etag(response, project)


@router.patch(
    "/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Update a depth-of-field keyframe",
    description="Update focus or lens parameters on a depth-of-field keyframe.",
    operation_id="updateDepthOfFieldKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def update_depth_of_field_keyframe(
    project_id: str,
    keyframe_id: str,
    data: DepthOfFieldKeyframeUpdate,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.update_depth_of_field_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)


@router.delete(
    "/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}",
    response_model=Project,
    summary="Delete a depth-of-field keyframe",
    description="Delete a keyframe from the depth-of-field timeline.",
    operation_id="deleteDepthOfFieldKeyframe",
    responses=MUTATION_ERROR_RESPONSES,
)
async def delete_depth_of_field_keyframe(
    project_id: str,
    keyframe_id: str,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    try:
        project = await service.delete_depth_of_field_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise _not_found(error) from error
    return with_project_etag(response, project)
