from __future__ import annotations

from camera_path.geometry import compile_project, validate_project
from camera_path.models import (
    Anchor,
    AnchorCreate,
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
