from __future__ import annotations

import asyncio
from dataclasses import dataclass

from camera_path.models import Project


class ProjectNotFoundError(KeyError):
    pass


class RevisionConflictError(RuntimeError):
    pass


@dataclass
class _History:
    snapshots: list[Project]
    cursor: int


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self._projects: dict[str, _History] = {}
        self._lock = asyncio.Lock()

    async def create(self, project: Project) -> Project:
        async with self._lock:
            self._projects[project.id] = _History([project.model_copy(deep=True)], 0)
        return project.model_copy(deep=True)

    async def get(self, project_id: str) -> Project:
        async with self._lock:
            history = self._history(project_id)
            return history.snapshots[history.cursor].model_copy(deep=True)

    async def commit(self, draft: Project, expected_revision: int) -> Project:
        async with self._lock:
            history = self._history(draft.id)
            current = history.snapshots[history.cursor]
            if current.revision != expected_revision:
                raise RevisionConflictError(
                    f"expected revision {expected_revision}, current revision is {current.revision}"
                )
            draft = draft.model_copy(deep=True)
            draft.revision = current.revision + 1
            del history.snapshots[history.cursor + 1 :]
            history.snapshots.append(draft)
            history.cursor += 1
            return draft.model_copy(deep=True)

    async def undo(self, project_id: str) -> Project:
        async with self._lock:
            history = self._history(project_id)
            if history.cursor == 0:
                return history.snapshots[0].model_copy(deep=True)
            history.cursor -= 1
            return history.snapshots[history.cursor].model_copy(deep=True)

    async def redo(self, project_id: str) -> Project:
        async with self._lock:
            history = self._history(project_id)
            if history.cursor + 1 < len(history.snapshots):
                history.cursor += 1
            return history.snapshots[history.cursor].model_copy(deep=True)

    def _history(self, project_id: str) -> _History:
        try:
            return self._projects[project_id]
        except KeyError as error:
            raise ProjectNotFoundError(project_id) from error
