from camera_path.models import (
    AimTimeline,
    CameraTrack,
    CompiledTrajectory,
    DepthOfFieldTimeline,
    MotionProfile,
    OrientationTimeline,
    Project,
    SpiralSegment,
    SpiralSegmentCreate,
    SplineSegment,
    SplineSegmentCreate,
    new_id,
)
from camera_path.repositories import ProjectRepository
from camera_path.repositories.aim_timeline import AimTimelineRepository
from camera_path.repositories.anchor import AnchorRepository
from camera_path.repositories.camera_track import CameraTrackRepository
from camera_path.repositories.chat_message import ChatMessageRepository
from camera_path.repositories.depth_of_field_timeline import DepthOfFieldTimelineRepository
from camera_path.repositories.orientation_timeline import OrientationTimelineRepository
from camera_path.repositories.scene_point import ScenePointRepository
from camera_path.repositories.speed_timeline import SpeedTimelineRepository
from camera_path.repositories.trajectory import TrajectoryRepository
from camera_path.services.base import ServiceBase
from camera_path.trajectory import compile_project


class TrajectoryService(ServiceBase):
    def __init__(self, repository: ProjectRepository, compile_tolerance: float = 1e-3) -> None:
        super().__init__(repository)
        self.compile_tolerance = compile_tolerance

    def compile_draft(self, project: Project) -> CompiledTrajectory:
        return compile_project(project, tolerance=self.compile_tolerance)

    async def save_agent_draft(self, draft: Project, expected: int) -> Project:
        """Commit the resources changed by a multi-command agent turn atomically."""
        async with self._transaction(draft, expected) as session:
            before = await self.repository._load(session, draft.id)
            if before.anchors != draft.anchors:
                await AnchorRepository(session).replace(
                    draft.id, {**before.anchors, **draft.anchors}
                )
            if before.scene_points != draft.scene_points:
                await ScenePointRepository(session).replace(
                    draft.id, {**before.scene_points, **draft.scene_points}
                )
            await session.flush()

            if (
                before.camera_track.default_aim != draft.camera_track.default_aim
                or before.camera_track.world_up != draft.camera_track.world_up
            ):
                await CameraTrackRepository(session).set_aim(
                    draft.id, draft.camera_track.default_aim, draft.camera_track.world_up
                )
            if before.camera_track.default_orientation != draft.camera_track.default_orientation:
                await CameraTrackRepository(session).set_orientation(
                    draft.id, draft.camera_track.default_orientation
                )
            if before.segments != draft.segments:
                await TrajectoryRepository(session).replace(draft.id, draft.segments)
            if before.motion_profile != draft.motion_profile:
                await SpeedTimelineRepository(session).replace(draft.id, draft.motion_profile)
            if before.camera_track.keyframes != draft.camera_track.keyframes:
                await AimTimelineRepository(session).replace(
                    draft.id,
                    AimTimeline(
                        default_aim=draft.camera_track.default_aim,
                        world_up=draft.camera_track.world_up,
                        keyframes=draft.camera_track.keyframes,
                    ),
                )
            if (
                before.camera_track.orientation_keyframes
                != draft.camera_track.orientation_keyframes
            ):
                await OrientationTimelineRepository(session).replace(
                    draft.id,
                    OrientationTimeline(
                        default_orientation=draft.camera_track.default_orientation,
                        keyframes=draft.camera_track.orientation_keyframes,
                    ),
                )
            if (
                before.camera_track.depth_of_field_keyframes
                != draft.camera_track.depth_of_field_keyframes
            ):
                await DepthOfFieldTimelineRepository(session).replace(
                    draft.id,
                    DepthOfFieldTimeline(keyframes=draft.camera_track.depth_of_field_keyframes),
                )
            await session.flush()
            if before.anchors != draft.anchors:
                await AnchorRepository(session).replace(draft.id, draft.anchors)
            if before.scene_points != draft.scene_points:
                await ScenePointRepository(session).replace(draft.id, draft.scene_points)
            if before.chat_history != draft.chat_history:
                await ChatMessageRepository(session).replace(draft.id, draft.chat_history)
        return draft

    async def _save_trajectory(
        self, draft: Project, expected: int, *, clear: bool = False
    ) -> Project:
        async with self._transaction(draft, expected) as session:
            await TrajectoryRepository(session).replace(draft.id, draft.segments)
            if clear:
                await SpeedTimelineRepository(session).replace(draft.id, draft.motion_profile)
                await CameraTrackRepository(session).set_aim(
                    draft.id, draft.camera_track.default_aim, draft.camera_track.world_up
                )
                await CameraTrackRepository(session).set_orientation(
                    draft.id, draft.camera_track.default_orientation
                )
                await AimTimelineRepository(session).replace(
                    draft.id,
                    AimTimeline(
                        default_aim=draft.camera_track.default_aim,
                        world_up=draft.camera_track.world_up,
                        keyframes=draft.camera_track.keyframes,
                    ),
                )
                await OrientationTimelineRepository(session).replace(
                    draft.id,
                    OrientationTimeline(
                        default_orientation=draft.camera_track.default_orientation,
                        keyframes=draft.camera_track.orientation_keyframes,
                    ),
                )
                await DepthOfFieldTimelineRepository(session).replace(
                    draft.id,
                    DepthOfFieldTimeline(keyframes=draft.camera_track.depth_of_field_keyframes),
                )
        return draft

    async def clear_trajectory(self, project_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.clear()
        draft.motion_profile = MotionProfile()
        draft.camera_track = CameraTrack()
        return await self._save_trajectory(draft, expected, clear=True)

    async def add_spline(self, project_id: str, data: SplineSegmentCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.append(SplineSegment(id=new_id(), **data.model_dump()))
        return await self._save_trajectory(draft, expected)

    async def add_spiral(self, project_id: str, data: SpiralSegmentCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.append(SpiralSegment(id=new_id(), **data.model_dump()))
        self.compile_draft(draft)
        return await self._save_trajectory(draft, expected)

    async def delete_segment(self, project_id: str, segment_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        before = len(draft.segments)
        draft.segments = [item for item in draft.segments if item.id != segment_id]
        if len(draft.segments) == before:
            raise KeyError(f"segment {segment_id} not found")
        return await self._save_trajectory(draft, expected)

    async def compile(self, project_id: str) -> CompiledTrajectory:
        return self.compile_draft(await self.repository.get(project_id))
