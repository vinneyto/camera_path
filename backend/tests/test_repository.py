from pathlib import Path

from camera_path.models import (
    Anchor,
    CameraOrientation,
    CameraOrientationKeyframe,
    ChatHistoryMessage,
    Project,
    ScenePoint,
)
from camera_path.repository import SQLiteProjectRepository


async def test_projects_and_chat_survive_repository_restart(tmp_path: Path) -> None:
    database_path = tmp_path / "camera_path.sqlite3"
    repository = SQLiteProjectRepository(database_path)
    first = await repository.create(Project(name="First"))
    second = await repository.create(Project(name="Second"))

    anchor = Anchor(label="Camera path", surface_position=(1, 2, 3))
    target = ScenePoint(label="Subject", position=(4, 5, 6))
    first.anchors[anchor.id] = anchor
    first.scene_points[target.id] = target
    first.chat_history.extend(
        [
            ChatHistoryMessage(role="user", content="Look at the subject"),
            ChatHistoryMessage(role="assistant", content="Added the target"),
        ]
    )
    orientation = CameraOrientationKeyframe(
        path_position=0.4,
        orientation=CameraOrientation(yaw_deg=25, pitch_deg=-5, roll_deg=180),
        interpolation_to_next="linear",
    )
    first.camera_track.default_orientation = CameraOrientation(roll_deg=3)
    first.camera_track.orientation_keyframes[orientation.id] = orientation
    saved = await repository.commit(first, first.revision)

    restarted = SQLiteProjectRepository(database_path)

    assert await restarted.get(first.id) == saved
    assert (await restarted.get(second.id)).name == "Second"
    assert [item.id for item in await restarted.list()] == [first.id, second.id]


def test_old_project_snapshot_gets_zero_orientation_defaults() -> None:
    payload = Project().model_dump()
    del payload["camera_track"]["default_orientation"]
    del payload["camera_track"]["orientation_keyframes"]

    restored = Project.model_validate(payload)

    assert restored.camera_track.default_orientation == CameraOrientation()
    assert restored.camera_track.orientation_keyframes == {}


def test_camera_track_always_has_a_follow_path_start_keyframe() -> None:
    project = Project()

    assert len(project.camera_track.keyframes) == 1
    keyframe = next(iter(project.camera_track.keyframes.values()))
    assert keyframe.path_position == 0
    assert keyframe.aim.kind == "follow_path"
    assert keyframe.aim.direction == "forward"


def test_legacy_default_look_at_becomes_stable_start_keyframe_after_round_trip() -> None:
    payload = Project().model_dump()
    payload["camera_track"]["keyframes"] = {}
    payload["camera_track"]["default_aim"] = {
        "kind": "look_at_point",
        "scene_point_id": "legacy-target",
    }

    restored = Project.model_validate(payload)
    reloaded = Project.model_validate_json(restored.model_dump_json())

    assert restored.camera_track.default_aim.kind == "follow_path"
    assert len(restored.camera_track.keyframes) == 1
    keyframe = next(iter(restored.camera_track.keyframes.values()))
    reloaded_keyframe = next(iter(reloaded.camera_track.keyframes.values()))
    assert keyframe.path_position == 0
    assert keyframe.aim.kind == "look_at_point"
    assert keyframe.aim.scene_point_id == "legacy-target"
    assert reloaded_keyframe == keyframe


def test_legacy_empty_camera_track_gets_stable_start_keyframe_after_round_trip() -> None:
    payload = Project().model_dump()
    payload["camera_track"]["keyframes"] = {}

    restored = Project.model_validate(payload)
    reloaded = Project.model_validate_json(restored.model_dump_json())

    assert len(restored.camera_track.keyframes) == 1
    keyframe = next(iter(restored.camera_track.keyframes.values()))
    assert keyframe.path_position == 0
    assert keyframe.aim.kind == "follow_path"
    assert next(iter(reloaded.camera_track.keyframes.values())) == keyframe


async def test_undo_and_redo_survive_repository_restart(tmp_path: Path) -> None:
    database_path = tmp_path / "camera_path.sqlite3"
    repository = SQLiteProjectRepository(database_path)
    project = await repository.create(Project())
    first = Anchor(label="A", surface_position=(0, 0, 0))
    project.anchors[first.id] = first
    project = await repository.commit(project, project.revision)
    second = Anchor(label="B", surface_position=(1, 0, 0))
    project.anchors[second.id] = second
    project = await repository.commit(project, project.revision)
    await repository.undo(project.id)

    restarted = SQLiteProjectRepository(database_path)
    undone = await restarted.get(project.id)

    assert first.id in undone.anchors
    assert second.id not in undone.anchors
    redone = await restarted.redo(project.id)
    assert second.id in redone.anchors


async def test_commit_after_undo_discards_redo_branch(tmp_path: Path) -> None:
    repository = SQLiteProjectRepository(tmp_path / "camera_path.sqlite3")
    project = await repository.create(Project())
    project.name = "revision one"
    project = await repository.commit(project, project.revision)
    project.name = "discard me"
    project = await repository.commit(project, project.revision)
    project = await repository.undo(project.id)
    project.name = "new revision two"
    project = await repository.commit(project, project.revision)

    assert (await repository.redo(project.id)).name == "new revision two"
