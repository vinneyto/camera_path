from __future__ import annotations

import asyncio

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import Project
from camera_path.persistence.database import create_engine_and_session_factory
from camera_path.persistence.models import Base, ProjectRecord, ProjectSnapshotRecord
from camera_path.repositories.exceptions import ProjectNotFoundError, RevisionConflictError


class ProjectRepository:
    """Aggregate project persistence backed by SQLAlchemy's async API."""

    def __init__(self, database_url: str) -> None:
        self.engine, self.session_factory = create_engine_and_session_factory(database_url)
        self._initialized = False
        self._initialize_lock = asyncio.Lock()

    async def initialize(self) -> None:
        if self._initialized:
            return
        async with self._initialize_lock:
            if self._initialized:
                return
            async with self.engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            self._initialized = True

    async def close(self) -> None:
        await self.engine.dispose()

    async def create(self, project: Project) -> Project:
        await self.initialize()
        async with self.session_factory.begin() as session:
            session.add(ProjectRecord(id=project.id, cursor=0))
            session.add(
                ProjectSnapshotRecord(
                    project_id=project.id,
                    position=0,
                    payload=project.model_dump_json(),
                )
            )
        return project.model_copy(deep=True)

    async def get(self, project_id: str) -> Project:
        await self.initialize()
        async with self.session_factory() as session:
            project, _ = await self._current_with_cursor(session, project_id)
            return project.model_copy(deep=True)

    async def list(self) -> list[Project]:
        await self.initialize()
        async with self.session_factory() as session:
            rows = await session.scalars(
                select(ProjectSnapshotRecord.payload)
                .join(ProjectRecord, ProjectSnapshotRecord.project_id == ProjectRecord.id)
                .where(ProjectSnapshotRecord.position == ProjectRecord.cursor)
            )
            return [Project.model_validate_json(payload) for payload in rows]

    async def delete(self, project_id: str) -> None:
        await self.initialize()
        async with self.session_factory.begin() as session:
            result = await session.execute(
                delete(ProjectRecord).where(ProjectRecord.id == project_id)
            )
            if result.rowcount == 0:
                raise ProjectNotFoundError(project_id)

    async def commit(self, draft: Project, expected_revision: int) -> Project:
        await self.initialize()
        async with self.session_factory.begin() as session:
            current, cursor = await self._current_with_cursor(session, draft.id)
            if current.revision != expected_revision:
                self._raise_revision_conflict(expected_revision, current.revision)

            next_position = cursor + 1
            moved = await session.execute(
                update(ProjectRecord)
                .where(ProjectRecord.id == draft.id, ProjectRecord.cursor == cursor)
                .values(cursor=next_position)
            )
            if moved.rowcount != 1:
                latest, _ = await self._current_with_cursor(session, draft.id)
                self._raise_revision_conflict(expected_revision, latest.revision)

            await session.execute(
                delete(ProjectSnapshotRecord).where(
                    ProjectSnapshotRecord.project_id == draft.id,
                    ProjectSnapshotRecord.position > cursor,
                )
            )
            committed = draft.model_copy(deep=True)
            committed.revision = current.revision + 1
            session.add(
                ProjectSnapshotRecord(
                    project_id=draft.id,
                    position=next_position,
                    payload=committed.model_dump_json(),
                )
            )
        return committed.model_copy(deep=True)

    async def undo(self, project_id: str) -> Project:
        await self.initialize()
        async with self.session_factory.begin() as session:
            _, cursor = await self._current_with_cursor(session, project_id)
            next_cursor = max(0, cursor - 1)
            await session.execute(
                update(ProjectRecord)
                .where(ProjectRecord.id == project_id)
                .values(cursor=next_cursor)
            )
            return (await self._snapshot(session, project_id, next_cursor)).model_copy(deep=True)

    async def redo(self, project_id: str) -> Project:
        await self.initialize()
        async with self.session_factory.begin() as session:
            _, cursor = await self._current_with_cursor(session, project_id)
            last_position = await session.scalar(
                select(func.max(ProjectSnapshotRecord.position)).where(
                    ProjectSnapshotRecord.project_id == project_id
                )
            )
            next_cursor = min(int(last_position), cursor + 1)
            await session.execute(
                update(ProjectRecord)
                .where(ProjectRecord.id == project_id)
                .values(cursor=next_cursor)
            )
            return (await self._snapshot(session, project_id, next_cursor)).model_copy(deep=True)

    async def _current_with_cursor(
        self, session: AsyncSession, project_id: str
    ) -> tuple[Project, int]:
        cursor = await session.scalar(
            select(ProjectRecord.cursor).where(ProjectRecord.id == project_id)
        )
        if cursor is None:
            raise ProjectNotFoundError(project_id)
        return await self._snapshot(session, project_id, cursor), cursor

    @staticmethod
    async def _snapshot(session: AsyncSession, project_id: str, position: int) -> Project:
        payload = await session.scalar(
            select(ProjectSnapshotRecord.payload).where(
                ProjectSnapshotRecord.project_id == project_id,
                ProjectSnapshotRecord.position == position,
            )
        )
        if payload is None:
            raise RuntimeError(f"project {project_id} has no snapshot at position {position}")
        return Project.model_validate_json(payload)

    @staticmethod
    def _raise_revision_conflict(expected: int, current: int) -> None:
        raise RevisionConflictError(f"expected revision {expected}, current revision is {current}")
