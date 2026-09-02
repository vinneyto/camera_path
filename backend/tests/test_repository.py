from pathlib import Path

from camera_path.models import Anchor, ChatHistoryMessage, Project, ScenePoint
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
    saved = await repository.commit(first, first.revision)

    restarted = SQLiteProjectRepository(database_path)

    assert await restarted.get(first.id) == saved
    assert (await restarted.get(second.id)).name == "Second"
    assert [item.id for item in await restarted.list()] == [first.id, second.id]


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
