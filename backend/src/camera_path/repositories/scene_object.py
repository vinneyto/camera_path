from __future__ import annotations

from uuid import uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from camera_path.persistence.records import ProjectRecord, SceneObjectRecord
from camera_path.repositories.exceptions import ProjectNotFoundError, ReferenceConflictError


class SceneObjectRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def list(self, project_id: str) -> tuple[list[SceneObjectRecord], int]:
        async with self.sessions() as session:
            revision = await session.scalar(
                select(ProjectRecord.revision).where(ProjectRecord.id == project_id)
            )
            if revision is None:
                raise ProjectNotFoundError(project_id)
            return await self._list(session, project_id), revision

    @staticmethod
    async def _list(session: AsyncSession, project_id: str) -> list[SceneObjectRecord]:
        return list(
            (
                await session.scalars(
                    select(SceneObjectRecord)
                    .where(SceneObjectRecord.project_id == project_id)
                    .order_by(SceneObjectRecord.sort_order)
                )
            ).all()
        )

    @staticmethod
    def _validate_parent(objects: list[SceneObjectRecord], object_id: str, parent_id: str | None):
        by_id = {item.id: item for item in objects}
        seen = {object_id}
        while parent_id is not None:
            if parent_id in seen:
                raise ValueError("Scene hierarchy cannot contain a cycle")
            parent = by_id.get(parent_id)
            if parent is None:
                raise KeyError("Parent scene object not found in this project")
            seen.add(parent_id)
            parent_id = parent.parent_id

    @staticmethod
    def _set_transform(record: SceneObjectRecord, values: dict):
        for field, axes in (("position", "xyz"), ("quaternion", "xyzw"), ("scale", "xyz")):
            if field in values:
                for axis, value in zip(axes, values[field], strict=True):
                    setattr(record, f"{field}_{axis}", value)

    async def add(
        self,
        session: AsyncSession,
        project_id: str,
        asset_id: str,
        file_id: str,
        parent_id: str | None,
        transform: dict,
    ) -> SceneObjectRecord:
        objects = await self._list(session, project_id)
        # Allocate in the same transaction as creation. Deletion/reordering never rewinds it.
        number = await session.scalar(
            update(ProjectRecord)
            .where(ProjectRecord.id == project_id)
            .values(scene_object_sequence=ProjectRecord.scene_object_sequence + 1)
            .returning(ProjectRecord.scene_object_sequence)
        )
        if number is None:
            raise ProjectNotFoundError(project_id)
        record = SceneObjectRecord(
            id=str(uuid4()),
            name=f"Gaussians {number:02d}",
            project_id=project_id,
            library_asset_id=asset_id,
            library_asset_file_id=file_id,
            parent_id=parent_id,
            sort_order=len(objects),
            visible=True,
        )
        self._validate_parent(objects, record.id, parent_id)
        self._set_transform(record, transform)
        session.add(record)
        await session.flush()
        return record

    async def update(
        self, session: AsyncSession, project_id: str, object_id: str, values: dict
    ) -> SceneObjectRecord:
        objects = await self._list(session, project_id)
        record = next((item for item in objects if item.id == object_id), None)
        if record is None:
            raise KeyError("Scene object not found")
        if "parent_id" in values:
            self._validate_parent(objects, object_id, values["parent_id"])
            record.parent_id = values["parent_id"]
        if "sort_order" in values:
            order = values["sort_order"]
            if order >= len(objects):
                raise ValueError("Scene object sort_order is out of range")
            objects.remove(record)
            objects.insert(order, record)
            await self._reorder(session, project_id, objects)
            await session.refresh(record)
        if "visible" in values:
            record.visible = values["visible"]
        self._set_transform(record, values)
        return record

    async def remove(self, session: AsyncSession, project_id: str, object_id: str) -> None:
        objects = await self._list(session, project_id)
        record = next((item for item in objects if item.id == object_id), None)
        if record is None:
            raise KeyError("Scene object not found")
        if any(item.parent_id == object_id for item in objects):
            raise ReferenceConflictError("Move or remove the object's children before deleting it")
        await session.delete(record)
        await session.flush()
        await self._reorder(session, project_id, [item for item in objects if item.id != object_id])

    async def remove_library_assets(self, session: AsyncSession, asset_ids: list[str]) -> None:
        # Validate all affected projects before storage staging/SQL commit can publish a deletion.
        targets = list(
            (
                await session.scalars(
                    select(SceneObjectRecord).where(
                        SceneObjectRecord.library_asset_id.in_(asset_ids)
                    )
                )
            ).all()
        )
        removed_ids = {item.id for item in targets}
        project_ids = sorted({item.project_id for item in targets})
        for project_id in project_ids:
            objects = await self._list(session, project_id)
            if any(
                item.parent_id in removed_ids and item.id not in removed_ids for item in objects
            ):
                raise ReferenceConflictError(
                    "A selected asset has scene objects with surviving children"
                )
        for project_id in project_ids:
            await session.execute(
                update(ProjectRecord)
                .where(ProjectRecord.id == project_id)
                .values(revision=ProjectRecord.revision + 1)
            )
            # The deferred parent FK permits deleting an entire selected subtree in one statement.
            await session.execute(
                delete(SceneObjectRecord).where(
                    SceneObjectRecord.project_id == project_id,
                    SceneObjectRecord.library_asset_id.in_(asset_ids),
                )
            )
            await self._reorder(session, project_id, await self._list(session, project_id))

    @staticmethod
    async def _reorder(session: AsyncSession, project_id: str, objects: list[SceneObjectRecord]):
        await session.execute(
            update(SceneObjectRecord)
            .where(SceneObjectRecord.project_id == project_id)
            .values(sort_order=-SceneObjectRecord.sort_order - 1)
            .execution_options(synchronize_session=False)
        )
        for index, record in enumerate(objects):
            await session.execute(
                update(SceneObjectRecord)
                .where(SceneObjectRecord.id == record.id)
                .values(sort_order=index)
                .execution_options(synchronize_session=False)
            )
