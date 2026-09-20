from camera_path.models import (
    CameraTrack,
    CompiledTrajectory,
    MotionProfile,
    Project,
    SpiralSegment,
    SpiralSegmentCreate,
    SplineSegment,
    SplineSegmentCreate,
)
from camera_path.repositories import ProjectRepositoryProtocol
from camera_path.services.base import ServiceBase
from camera_path.trajectory import compile_project


class TrajectoryService(ServiceBase):
    def __init__(
        self, repository: ProjectRepositoryProtocol, compile_tolerance: float = 1e-3
    ) -> None:
        super().__init__(repository)
        self.compile_tolerance = compile_tolerance

    def compile_draft(self, project: Project) -> CompiledTrajectory:
        return compile_project(project, tolerance=self.compile_tolerance)

    async def clear_trajectory(self, project_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.clear()
        draft.motion_profile = MotionProfile()
        draft.camera_track = CameraTrack()
        return await self._commit(draft, expected)

    async def add_spline(self, project_id: str, data: SplineSegmentCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.append(SplineSegment(**data.model_dump()))
        return await self._commit(draft, expected)

    async def add_spiral(self, project_id: str, data: SpiralSegmentCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.append(SpiralSegment(**data.model_dump()))
        self.compile_draft(draft)
        return await self._commit(draft, expected)

    async def delete_segment(self, project_id: str, segment_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        before = len(draft.segments)
        draft.segments = [item for item in draft.segments if item.id != segment_id]
        if len(draft.segments) == before:
            raise KeyError(f"segment {segment_id} not found")
        return await self._commit(draft, expected)

    async def compile(self, project_id: str) -> CompiledTrajectory:
        return self.compile_draft(await self.repository.get(project_id))
