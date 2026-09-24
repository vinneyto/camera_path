from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import Project
from camera_path.repositories import ProjectRepository
from camera_path.services.revisions import advance_project_revision
from camera_path.trajectory import validate_project


class ServiceBase:
    def __init__(self, repository: ProjectRepository) -> None:
        self.repository = repository

    @asynccontextmanager
    async def _transaction(self, draft: Project, expected: int) -> AsyncIterator[AsyncSession]:
        validate_project(draft)
        async with self.repository.session_factory.begin() as session:
            await advance_project_revision(session, draft.id, expected)
            yield session
        draft.revision = expected + 1
