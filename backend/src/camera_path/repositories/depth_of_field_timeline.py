from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import (
    CenterWeightedDepthOfFieldFocus,
    DepthOfFieldKeyframe,
    DepthOfFieldTimeline,
    ScenePointDepthOfFieldFocus,
)
from camera_path.persistence.models import DepthOfFieldKeyframeRecord


class DepthOfFieldTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> DepthOfFieldTimeline:
        records = await self.session.scalars(
            select(DepthOfFieldKeyframeRecord).where(
                DepthOfFieldKeyframeRecord.project_id == project_id
            )
        )
        return DepthOfFieldTimeline(
            keyframes={
                record.id: DepthOfFieldKeyframe(
                    id=record.id,
                    path_position=record.path_position,
                    focus=(
                        ScenePointDepthOfFieldFocus(scene_point_id=record.focus_scene_point_id)
                        if record.focus_kind == "scene_point"
                        else CenterWeightedDepthOfFieldFocus()
                    ),
                    focus_range_scale=record.focus_range_scale,
                    bokeh_scale=record.bokeh_scale,
                )
                for record in records
            }
        )

    async def replace(self, project_id: str, timeline: DepthOfFieldTimeline) -> None:
        await self.session.execute(
            delete(DepthOfFieldKeyframeRecord).where(
                DepthOfFieldKeyframeRecord.project_id == project_id
            )
        )
        self.session.add_all(
            DepthOfFieldKeyframeRecord(
                id=item.id,
                project_id=project_id,
                path_position=item.path_position,
                focus_kind=item.focus.kind,
                focus_scene_point_id=(
                    item.focus.scene_point_id
                    if isinstance(item.focus, ScenePointDepthOfFieldFocus)
                    else None
                ),
                focus_range_scale=item.focus_range_scale,
                bokeh_scale=item.bokeh_scale,
            )
            for item in timeline.keyframes.values()
        )
