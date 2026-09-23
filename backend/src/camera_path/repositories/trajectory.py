from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from camera_path.models import SpiralSegment, SplineSegment, TrajectorySegment
from camera_path.persistence.models import SegmentAnchorRecord, TrajectorySegmentRecord


class TrajectoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> list[TrajectorySegment]:
        records = await self.session.scalars(
            select(TrajectorySegmentRecord)
            .where(TrajectorySegmentRecord.project_id == project_id)
            .order_by(TrajectorySegmentRecord.position)
            .options(selectinload(TrajectorySegmentRecord.anchors))
        )
        result: list[TrajectorySegment] = []
        for record in records:
            anchor_ids = [
                anchor.anchor_id for anchor in sorted(record.anchors, key=lambda a: a.position)
            ]
            if record.kind == "spline":
                result.append(
                    SplineSegment(id=record.id, anchor_ids=anchor_ids, tension=record.tension)
                )
            else:
                result.append(
                    SpiralSegment(
                        id=record.id,
                        start_anchor_id=anchor_ids[0],
                        center_anchor_id=anchor_ids[1],
                        end_anchor_id=anchor_ids[2],
                        turns=record.turns,
                        direction=record.direction,
                        radial_law=record.radial_law,
                        axial_law=record.axial_law,
                    )
                )
        return result

    async def replace(self, project_id: str, segments: list[TrajectorySegment]) -> None:
        await self.session.execute(
            delete(TrajectorySegmentRecord).where(TrajectorySegmentRecord.project_id == project_id)
        )
        for position, segment in enumerate(segments):
            self.session.add(
                TrajectorySegmentRecord(
                    id=segment.id,
                    project_id=project_id,
                    position=position,
                    kind=segment.kind,
                    tension=segment.tension if isinstance(segment, SplineSegment) else None,
                    turns=segment.turns if isinstance(segment, SpiralSegment) else None,
                    direction=segment.direction if isinstance(segment, SpiralSegment) else None,
                    radial_law=segment.radial_law if isinstance(segment, SpiralSegment) else None,
                    axial_law=segment.axial_law if isinstance(segment, SpiralSegment) else None,
                )
            )
            anchor_ids = (
                segment.anchor_ids
                if isinstance(segment, SplineSegment)
                else [segment.start_anchor_id, segment.center_anchor_id, segment.end_anchor_id]
            )
            self.session.add_all(
                SegmentAnchorRecord(segment_id=segment.id, position=index, anchor_id=anchor_id)
                for index, anchor_id in enumerate(anchor_ids)
            )
