from __future__ import annotations

from camera_path.geometry import compile_project, validate_project
from camera_path.models import (
    Anchor,
    AnchorCreate,
    AnchorUpdate,
    CompiledTrajectory,
    Project,
    ProjectCreate,
    SpiralSegment,
    SpiralSegmentCreate,
    SplineSegment,
    SplineSegmentCreate,
)
from camera_path.repository import InMemoryProjectRepository


class TrajectoryService:
    def __init__(self, repository: InMemoryProjectRepository) -> None:
        self.repository = repository

    async def create_project(self, data: ProjectCreate) -> Project:
        return await self.repository.create(Project(name=data.name))

    async def add_anchor(self, project_id: str, data: AnchorCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        anchor = Anchor(**data.model_dump())
        draft.anchors[anchor.id] = anchor
        return await self.repository.commit(draft, expected)

    async def update_anchor(self, project_id: str, anchor_id: str, data: AnchorUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if anchor_id not in draft.anchors:
            raise KeyError(f"anchor {anchor_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        draft.anchors[anchor_id] = draft.anchors[anchor_id].model_copy(update=patch)
        return await self.repository.commit(draft, expected)

    async def delete_anchor(self, project_id: str, anchor_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if anchor_id not in draft.anchors:
            raise KeyError(f"anchor {anchor_id} not found")
        for segment in draft.segments:
            references = (
                segment.anchor_ids
                if isinstance(segment, SplineSegment)
                else [segment.start_anchor_id, segment.center_anchor_id, segment.end_anchor_id]
            )
            if anchor_id in references:
                raise ValueError(f"anchor {anchor_id} is used by segment {segment.id}")
        del draft.anchors[anchor_id]
        return await self.repository.commit(draft, expected)

    async def add_spline(self, project_id: str, data: SplineSegmentCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.append(SplineSegment(**data.model_dump()))
        validate_project(draft)
        return await self.repository.commit(draft, expected)

    async def add_spiral(self, project_id: str, data: SpiralSegmentCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.append(SpiralSegment(**data.model_dump()))
        validate_project(draft)
        compile_project(draft)
        return await self.repository.commit(draft, expected)

    async def compile(self, project_id: str) -> CompiledTrajectory:
        return compile_project(await self.repository.get(project_id))
