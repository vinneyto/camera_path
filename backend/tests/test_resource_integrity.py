import sqlite3

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from camera_path.models import (
    Anchor,
    AnchorUpdate,
    CameraKeyframe,
    LookAtPointAim,
    Project,
    ScenePoint,
)
from camera_path.persistence.models import ProjectRecord
from camera_path.repositories import ProjectRepository
from camera_path.repositories.aim_timeline import AimTimelineRepository
from camera_path.services.anchors import AnchorService


async def test_resource_edit_preserves_unrelated_rows(tmp_path) -> None:
    path = tmp_path / "preserve.sqlite3"
    repository = ProjectRepository(f"sqlite+aiosqlite:///{path}")
    project = Project()
    first = Anchor(label="First", surface_position=(0, 0, 0))
    second = Anchor(label="Second", surface_position=(1, 0, 0))
    point = ScenePoint(label="Target", position=(0, 0, 1))
    project.anchors = {first.id: first, second.id: second}
    project.scene_points[point.id] = point
    await repository.create(project)

    def rowids() -> tuple[int, int, int]:
        with sqlite3.connect(path) as db:
            return (
                db.execute("SELECT rowid FROM anchors WHERE id = ?", (first.id,)).fetchone()[0],
                db.execute("SELECT rowid FROM anchors WHERE id = ?", (second.id,)).fetchone()[0],
                db.execute("SELECT rowid FROM scene_points WHERE id = ?", (point.id,)).fetchone()[
                    0
                ],
            )

    before = rowids()
    updated = await AnchorService(repository).update_anchor(
        project.id, first.id, AnchorUpdate(label="Renamed")
    )
    assert updated.revision == 1
    assert rowids() == before
    assert (await repository.get(project.id)).anchors[first.id].label == "Renamed"

    updated.name = "New name"
    await repository.commit(updated, updated.revision)
    assert rowids() == before
    await repository.close()


async def test_scene_point_reference_is_project_scoped_and_project_can_be_deleted(tmp_path) -> None:
    path = tmp_path / "references.sqlite3"
    repository = ProjectRepository(f"sqlite+aiosqlite:///{path}")
    target = ScenePoint(label="Target", position=(0, 0, 0))
    other = Project()
    other.scene_points[target.id] = target
    await repository.create(other)
    project = await repository.create(Project())
    with pytest.raises(IntegrityError):
        async with repository.session_factory.begin() as session:
            record = await session.get(ProjectRecord, project.id)
            assert record is not None
            from camera_path.persistence.models import CameraTrackRecord

            camera = await session.get(CameraTrackRecord, project.id)
            assert camera is not None
            camera.set_default_aim(LookAtPointAim(scene_point_id=target.id))

    with pytest.raises(IntegrityError):
        async with repository.session_factory.begin() as session:
            await session.execute(
                text(
                    "UPDATE camera_tracks SET default_aim_direction = 'sideways' "
                    "WHERE project_id = :project_id"
                ),
                {"project_id": project.id},
            )

    local = ScenePoint(label="Local", position=(1, 0, 0))
    other_project = Project()
    other_project.scene_points[local.id] = local
    other_project.camera_track.default_aim = LookAtPointAim(scene_point_id=local.id)
    key = CameraKeyframe(path_position=0, aim=LookAtPointAim(scene_point_id=local.id))
    other_project.camera_track.keyframes[key.id] = key
    await repository.create(other_project)
    await repository.delete(other_project.id)
    await repository.close()


async def test_get_does_not_create_camera_track(tmp_path) -> None:
    repository = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'read.sqlite3'}")
    await repository.initialize()
    async with repository.session_factory.begin() as session:
        session.add(ProjectRecord(id="missing-track", name="Old", revision=0))
    async with repository.session_factory.begin() as session:
        with pytest.raises(LookupError, match="camera track missing"):
            await AimTimelineRepository(session).get("missing-track")
    with sqlite3.connect(tmp_path / "read.sqlite3") as db:
        assert db.execute(
            "SELECT COUNT(*) FROM camera_tracks WHERE project_id = 'missing-track'"
        ).fetchone() == (0,)
    await repository.close()


def test_migration_backfills_track_without_lazy_read(tmp_path, monkeypatch) -> None:
    from alembic.config import Config

    from alembic import command
    from camera_path.config import settings

    path = tmp_path / "backfill.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260924_0005")
    with sqlite3.connect(path) as db:
        db.execute("INSERT INTO projects (id, name, revision) VALUES ('old', 'Old', 0)")
    command.upgrade(config, "head")
    with sqlite3.connect(path) as db:
        assert db.execute(
            "SELECT default_aim_kind, default_aim_direction FROM camera_tracks "
            "WHERE project_id = 'old'"
        ).fetchone() == ("follow_path", "forward")
