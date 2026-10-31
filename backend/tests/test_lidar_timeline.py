import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from camera_path.config import Settings
from camera_path.persistence.records import LidarKeyframeRecord
from camera_path.repositories import ProjectRepository


@pytest.fixture
async def repository(tmp_path):
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'lidar.sqlite3'}")
    yield repo
    await repo.close()


async def test_single_presence_keyframe_survives_reload_updates_and_other_edits(repository):
    app = create_editor_app(Settings(_env_file=None), repository)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/api/v1/projects", json={"name": "LiDAR"})).json()
        url = f"/api/v1/projects/{project['id']}/camera/lidar"
        assert (await client.get(url)).json() == {"lidar_keyframe": None}
        assert (await client.patch(url, json={})).status_code == 428
        response = await client.patch(url, json={}, headers={"If-Match": '"0"'})
        assert response.status_code == 200
        assert response.headers["ETag"] == '"1"'
        first = response.json()["lidar_keyframe"]
        assert first["path_position"] == 0
        assert (
            first["vertical_fov_deg"],
            first["horizontal_resolution"],
            first["vertical_resolution"],
        ) == (60, 512, 32)
        assert (await client.patch(url, json={}, headers={"If-Match": '"0"'})).status_code == 409
        updated = await client.patch(
            url,
            json={"vertical_fov_deg": 90, "horizontal_resolution": 1024, "vertical_resolution": 64},
            headers={"If-Match": '"1"'},
        )
        key = updated.json()["lidar_keyframe"]
        assert key["id"] == first["id"]
        assert key["path_position"] == 0
        # An aggregate edit by existing clients must preserve the new resource.
        await client.post(
            f"/projects/{project['id']}/anchors", json={"label": "A", "surface_position": [1, 2, 3]}
        )
        assert (await client.get(url)).json()["lidar_keyframe"] == key
        reloaded = await repository.get(project["id"])
        assert reloaded.camera_track.lidar_keyframe.model_dump() == key
        response = await client.delete(url, headers={"If-Match": '"3"'})
        assert response.status_code == 204
        assert (await client.get(url)).json() == {"lidar_keyframe": None}
        await client.patch(url, json={}, headers={"If-Match": '"4"'})
        await client.delete(f"/api/v1/projects/{project['id']}", headers={"If-Match": '"5"'})
        async with repository.session_factory() as session:
            assert list(await session.scalars(select(LidarKeyframeRecord))) == []


@pytest.mark.parametrize(
    "payload",
    [
        {"vertical_fov_deg": 0},
        {"vertical_fov_deg": 180},
        {"horizontal_resolution": 0},
        {"horizontal_resolution": 4097},
        {"vertical_resolution": 257},
        {"vertical_resolution": 1.5},
        {"path_position": 0.5},
        {"keyframes": []},
    ],
)
async def test_invalid_or_animated_settings_are_rejected(repository, payload):
    app = create_editor_app(Settings(_env_file=None), repository)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/api/v1/projects", json={})).json()
        url = f"/api/v1/projects/{project['id']}/camera/lidar"
        assert (
            await client.patch(url, json=payload, headers={"If-Match": '"0"'})
        ).status_code == 422
        assert (await client.get(url)).json() == {"lidar_keyframe": None}


async def test_partial_settings_and_clear_reset_remove_the_presence_resource(repository):
    from camera_path.models import LidarSettings, ProjectCreate
    from camera_path.services.projects import ProjectService
    from camera_path.services.timelines import TimelineService
    from camera_path.services.trajectory import TrajectoryService

    projects = ProjectService(repository)
    timelines = TimelineService(repository)
    project = await projects.create_project(ProjectCreate(name="Static settings"))
    configured = await timelines.set_lidar(project.id, LidarSettings(horizontal_resolution=1024))
    updated = await timelines.set_lidar(project.id, LidarSettings(vertical_fov_deg=90))
    assert updated.camera_track.lidar_keyframe.horizontal_resolution == 1024
    assert updated.camera_track.lidar_keyframe.id == configured.camera_track.lidar_keyframe.id
    await TrajectoryService(repository).clear_trajectory(project.id)
    assert (await repository.get(project.id)).camera_track.lidar_keyframe is None
    await timelines.set_lidar(project.id, LidarSettings())
    await projects.reset_project(project.id)
    assert (await repository.get(project.id)).camera_track.lidar_keyframe is None


async def test_create_defaults_preserves_existing_lidar_and_recreates_after_deletion(repository):
    from camera_path.models import LidarKeyframe, LidarSettings, ProjectCreate
    from camera_path.services.projects import ProjectService
    from camera_path.services.timelines import TimelineService

    project = await ProjectService(repository).create_project(ProjectCreate(name="Defaults"))
    timelines = TimelineService(repository)
    configured = await timelines.set_lidar(
        project.id, LidarSettings(vertical_fov_deg=90, horizontal_resolution=1024)
    )
    original = configured.camera_track.lidar_keyframe
    repeated = await timelines.set_lidar(project.id, LidarSettings())
    assert repeated.camera_track.lidar_keyframe == original
    assert (await repository.get(project.id)).camera_track.lidar_keyframe == original

    await timelines.set_lidar(project.id, None)
    recreated = await timelines.set_lidar(project.id, LidarSettings())
    keyframe = recreated.camera_track.lidar_keyframe
    assert keyframe.id != original.id
    assert keyframe == LidarKeyframe(id=keyframe.id)
    assert (await repository.get(project.id)).camera_track.lidar_keyframe == keyframe
