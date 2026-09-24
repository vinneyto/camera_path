from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.persistence.models import ProjectRecord
from camera_path.repositories.exceptions import ProjectNotFoundError, RevisionConflictError


async def advance_project_revision(session: AsyncSession, project_id: str, expected: int) -> int:
    changed = await session.execute(
        update(ProjectRecord)
        .where(ProjectRecord.id == project_id, ProjectRecord.revision == expected)
        .values(revision=expected + 1)
    )
    if changed.rowcount != 1:
        current = await session.scalar(
            select(ProjectRecord.revision).where(ProjectRecord.id == project_id)
        )
        if current is None:
            raise ProjectNotFoundError(project_id)
        raise RevisionConflictError(f"expected revision {expected}, current revision is {current}")
    return expected + 1
