import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient

from camera_path.config import Settings
from camera_path.models import (
    Anchor,
    CameraKeyframe,
    CameraOrientation,
    CameraOrientationKeyframe,
    DepthOfFieldKeyframe,
    FollowPathAim,
    LidarKeyframe,
    Project,
    ScenePoint,
    SpeedKeyframe,
    SplineSegment,
)
from camera_path.repositories import ProjectRepository


@pytest.fixture
async def repository(tmp_path):
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'dof.sqlite3'}")
    yield repo
    await repo.close()


async def test_delete_entire_timeline_is_atomic_persistent_and_preserves_other_tracks(repository):
    project = Project(name="DOF deletion")
    anchors = [
        Anchor(label="A", surface_position=(0, 0, 0)),
        Anchor(label="B", surface_position=(2, 0, 0)),
    ]
    project.anchors = {anchor.id: anchor for anchor in anchors}
    project.segments = [SplineSegment(anchor_ids=list(project.anchors))]
    point = ScenePoint(label="Subject", position=(1, 0, 1))
    project.scene_points[point.id] = point
    speed = SpeedKeyframe(path_position=0, speed=2)
    project.motion_profile.keyframes[speed.id] = speed
    aim = CameraKeyframe(path_position=0, aim=FollowPathAim())
    project.camera_track.keyframes[aim.id] = aim
    orientation = CameraOrientationKeyframe(
        path_position=0.5, orientation=CameraOrientation(yaw_deg=30)
    )
    project.camera_track.orientation_keyframes[orientation.id] = orientation
    project.camera_track.lidar_keyframe = LidarKeyframe(horizontal_resolution=1024)
    for position in (0, 0.4, 1):
        key = DepthOfFieldKeyframe(path_position=position, bokeh_scale=12)
        project.camera_track.depth_of_field_keyframes[key.id] = key
    await repository.create(project)
    expected = project.model_copy(deep=True)
    expected.camera_track.depth_of_field_keyframes.clear()
    expected.revision += 1
    app = create_editor_app(Settings(_env_file=None), repository)
    url = f"/api/v1/projects/{project.id}/camera/depth-of-field"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.delete(url)).status_code == 428
        assert len((await repository.get(project.id)).camera_track.depth_of_field_keyframes) == 3
        response = await client.delete(url, headers={"If-Match": '"0"'})
        assert response.status_code == 204
        assert response.headers["ETag"] == '"1"'
        assert (await client.get(url)).json() == {"keyframes": {}}
        assert await repository.get(project.id) == expected
        compiled = (await client.get(f"/projects/{project.id}/trajectory/compiled")).json()
        assert compiled["camera_track"]["depth_of_field_keyframes"] == []
        assert len(compiled["position_segments"]) == 1
        assert (await client.delete(url, headers={"If-Match": '"0"'})).status_code == 409
        assert (await client.delete(url, headers={"If-Match": '"1"'})).status_code == 204
        assert (
            await client.delete(
                "/api/v1/projects/missing/camera/depth-of-field", headers={"If-Match": '"0"'}
            )
        ).status_code == 404
        app.dependency_overrides.clear()
        assert (await client.delete(url, headers={"If-Match": '"2"'})).status_code == 401
