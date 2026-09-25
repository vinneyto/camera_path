from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from camera_path.persistence.models import LibraryAssetRecord, ProjectCloudRecord, ProjectRecord
from camera_path.repositories.exceptions import ProjectNotFoundError


class ProjectCloudRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    @staticmethod
    async def _revision(session: AsyncSession, project_id: str) -> int:
        revision = await session.scalar(
            select(ProjectRecord.revision).where(ProjectRecord.id == project_id)
        )
        if revision is None:
            raise ProjectNotFoundError(project_id)
        return revision

    @staticmethod
    async def _list(session: AsyncSession, project_id: str) -> list[ProjectCloudRecord]:
        return list(
            (
                await session.scalars(
                    select(ProjectCloudRecord)
                    .where(ProjectCloudRecord.project_id == project_id)
                    .order_by(ProjectCloudRecord.position)
                )
            ).all()
        )

    async def list(self, project_id: str) -> tuple[list[ProjectCloudRecord], int]:
        async with self.sessions() as session:
            revision = await self._revision(session, project_id)
            return await self._list(session, project_id), revision

    async def add(
        self, session: AsyncSession, project_id: str, asset: LibraryAssetRecord
    ) -> ProjectCloudRecord:
        position = len(await self._list(session, project_id))
        cloud = ProjectCloudRecord(
            id=str(uuid4()),
            project_id=project_id,
            library_asset_id=asset.id,
            position=position,
            visible=True,
            rotation_x_deg=asset.default_rotation_x_deg,
            rotation_y_deg=asset.default_rotation_y_deg,
            rotation_z_deg=asset.default_rotation_z_deg,
            scale=asset.default_scale,
        )
        session.add(cloud)
        await session.flush()
        return cloud

    async def remove(self, session: AsyncSession, project_id: str, cloud_id: str) -> None:
        clouds = await self._list(session, project_id)
        cloud = next((item for item in clouds if item.id == cloud_id), None)
        if cloud is None:
            raise KeyError("Project cloud not found")
        await session.delete(cloud)
        await session.flush()
        await self._reorder(session, project_id, [item for item in clouds if item.id != cloud_id])

    @staticmethod
    async def _reorder(
        session: AsyncSession, project_id: str, clouds: list[ProjectCloudRecord]
    ) -> None:
        # Move every position outside the positive range before assigning the final order;
        # the unique (project_id, position) constraint applies after each UPDATE on SQLite.
        await session.execute(
            update(ProjectCloudRecord)
            .where(ProjectCloudRecord.project_id == project_id)
            .values(position=-ProjectCloudRecord.position - 1)
            .execution_options(synchronize_session=False)
        )
        for index, cloud in enumerate(clouds):
            await session.execute(
                update(ProjectCloudRecord)
                .where(ProjectCloudRecord.id == cloud.id)
                .values(position=index)
                .execution_options(synchronize_session=False)
            )

    async def update(
        self,
        session: AsyncSession,
        project_id: str,
        cloud_id: str,
        position: int | None,
        visible: bool | None,
    ) -> ProjectCloudRecord:
        clouds = await self._list(session, project_id)
        cloud = next((item for item in clouds if item.id == cloud_id), None)
        if cloud is None:
            raise KeyError("Project cloud not found")
        if position is not None and position >= len(clouds):
            raise ValueError("Cloud position is out of range")
        if position is not None:
            clouds.remove(cloud)
            clouds.insert(position, cloud)
            await self._reorder(session, project_id, clouds)
            await session.refresh(cloud)
        if visible is not None:
            cloud.visible = visible
        return cloud
