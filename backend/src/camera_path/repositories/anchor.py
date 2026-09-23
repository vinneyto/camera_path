from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import Anchor
from camera_path.persistence.models import AnchorRecord


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
                surface_position=(
                    record.surface_position_x,
                    record.surface_position_y,
                    record.surface_position_z,
                ),
                surface_normal=(
                    record.surface_normal_x,
                    record.surface_normal_y,
                    record.surface_normal_z,
                ),
                lift=record.lift,
                lift_axis=record.lift_axis,
            )
            for record in records
        }

    async def replace(self, project_id: str, anchors: dict[str, Anchor]) -> None:
        await self.session.execute(
            delete(AnchorRecord).where(AnchorRecord.project_id == project_id)
        )
        self.session.add_all(
            AnchorRecord(
                id=item.id,
                project_id=project_id,
                label=item.label,
                surface_position_x=item.surface_position[0],
                surface_position_y=item.surface_position[1],
                surface_position_z=item.surface_position[2],
                surface_normal_x=item.surface_normal[0],
                surface_normal_y=item.surface_normal[1],
                surface_normal_z=item.surface_normal[2],
                lift=item.lift,
                lift_axis=item.lift_axis,
            )
            for item in anchors.values()
        )
