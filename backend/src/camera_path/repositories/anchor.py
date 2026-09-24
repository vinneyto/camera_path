from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import Anchor
from camera_path.persistence.models import AnchorRecord, Vector3
from camera_path.repositories.sync import sync_rows


class AnchorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, project_id: str) -> dict[str, Anchor]:
        records = await self.session.scalars(
            select(AnchorRecord).where(AnchorRecord.project_id == project_id)
        )
        return {
            record.id: Anchor(
                id=record.id,
                label=record.label,
                surface_position=record.surface_position.as_tuple(),
                surface_normal=record.surface_normal.as_tuple(),
                lift=record.lift,
                lift_axis=record.lift_axis,
            )
            for record in records
        }

    async def replace(self, project_id: str, anchors: dict[str, Anchor]) -> None:
        await sync_rows(
            self.session,
            AnchorRecord,
            project_id,
            [
                dict(
                    id=item.id,
                    project_id=project_id,
                    label=item.label,
                    surface_position=Vector3(*item.surface_position),
                    surface_normal=Vector3(*item.surface_normal),
                    lift=item.lift,
                    lift_axis=item.lift_axis,
                )
                for item in anchors.values()
            ],
        )
