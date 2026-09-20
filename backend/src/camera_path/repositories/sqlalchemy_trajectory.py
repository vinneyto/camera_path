from __future__ import annotations

import json

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import SpiralSegment, SplineSegment, TrajectorySegment
from camera_path.persistence.models import SegmentAnchorRecord, TrajectorySegmentRecord


class SQLAlchemyTrajectoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> list[TrajectorySegment]:
        records = await self.session.scalars(
            select(TrajectorySegmentRecord)
            .where(TrajectorySegmentRecord.project_id == project_id)
            .order_by(TrajectorySegmentRecord.position)
        )
        result: list[TrajectorySegment] = []
        for record in records:
            payload = json.loads(record.payload)
            model = SplineSegment if payload["kind"] == "spline" else SpiralSegment
            result.append(model.model_validate(payload))
        return result

    async def replace(self, project_id: str, segments: list[TrajectorySegment]) -> None:
        await self.session.execute(
            delete(TrajectorySegmentRecord).where(
                TrajectorySegmentRecord.project_id == project_id
            )
        )
        for position, segment in enumerate(segments):
            self.session.add(
                TrajectorySegmentRecord(
                    id=segment.id,
                    project_id=project_id,
                    position=position,
                    payload=segment.model_dump_json(),
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
