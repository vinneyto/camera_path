from __future__ import annotations

from camera_path.geometry import compile_project, validate_project
from camera_path.models import (
    Anchor,
    AnchorCreate,
    AnchorUpdate,
    CameraKeyframe,
    CameraKeyframeCreate,
    CameraKeyframeUpdate,
    CameraTrack,
    CameraTrackUpdate,
    CompiledTrajectory,
    LookAtPointAim,
    MotionProfile,
    MotionProfileUpdate,
    Project,
    ProjectCreate,
    ProjectUpdate,
    ScenePoint,
    ScenePointCreate,
    ScenePointUpdate,
    SpeedKeyframe,
    SpeedKeyframeCreate,
    SpeedKeyframeUpdate,
    SpiralSegment,
    SpiralSegmentCreate,
    SplineSegment,
    SplineSegmentCreate,
)
from camera_path.repository import ProjectRepository


class TrajectoryService:
    def __init__(self, repository: ProjectRepository, compile_tolerance: float = 1e-3) -> None:
        self.repository = repository
        self.compile_tolerance = compile_tolerance

    async def create_project(self, data: ProjectCreate) -> Project:
        return await self.repository.create(Project(name=data.name))

    async def list_projects(self) -> list[Project]:
        return await self.repository.list()

    async def get_project(self, project_id: str) -> Project:
        return await self.repository.get(project_id)

    async def update_project(self, project_id: str, data: ProjectUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.name = data.name
        return await self._commit(draft, expected)

    async def delete_project(self, project_id: str) -> None:
        await self.repository.delete(project_id)

    async def clear_chat(self, project_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.chat_history.clear()
        return await self._commit(draft, expected)

    async def clear_trajectory(self, project_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.segments.clear()
        draft.motion_profile = MotionProfile()
        draft.camera_track = CameraTrack()
        return await self._commit(draft, expected)

    async def reset_project(self, project_id: str) -> Project:
        current = await self.repository.get(project_id)
        draft = Project(id=current.id, name=current.name, revision=current.revision)
        return await self._commit(draft, current.revision)

    async def undo(self, project_id: str) -> Project:
        return await self.repository.undo(project_id)

    async def redo(self, project_id: str) -> Project:
        return await self.repository.redo(project_id)

    async def _commit(self, draft: Project, expected: int) -> Project:
        validate_project(draft)
        return await self.repository.commit(draft, expected)

    async def commit_draft(self, draft: Project, expected_revision: int) -> Project:
        self.compile_draft(draft)
        return await self.repository.commit(draft, expected_revision)

    async def add_anchor(self, project_id: str, data: AnchorCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        anchor = Anchor(**data.model_dump())
        draft.anchors[anchor.id] = anchor
        return await self._commit(draft, expected)

    async def update_anchor(self, project_id: str, anchor_id: str, data: AnchorUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if anchor_id not in draft.anchors:
            raise KeyError(f"anchor {anchor_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        draft.anchors[anchor_id] = draft.anchors[anchor_id].model_copy(update=patch)
        return await self._commit(draft, expected)

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
        return await self._commit(draft, expected)

    async def add_scene_point(self, project_id: str, data: ScenePointCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        point = ScenePoint(**data.model_dump())
        draft.scene_points[point.id] = point
        return await self._commit(draft, expected)

    async def update_scene_point(
        self, project_id: str, point_id: str, data: ScenePointUpdate
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if point_id not in draft.scene_points:
            raise KeyError(f"scene point {point_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        draft.scene_points[point_id] = draft.scene_points[point_id].model_copy(update=patch)
        return await self._commit(draft, expected)

    async def delete_scene_point(
        self, project_id: str, point_id: str, cascade: bool = False
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if point_id not in draft.scene_points:
            raise KeyError(f"scene point {point_id} not found")
        references = [
            item.id
            for item in draft.camera_track.keyframes.values()
            if isinstance(item.aim, LookAtPointAim) and item.aim.scene_point_id == point_id
        ]
        default_references = (
            isinstance(draft.camera_track.default_aim, LookAtPointAim)
            and draft.camera_track.default_aim.scene_point_id == point_id
        )
        if default_references:
            raise ValueError(f"scene point {point_id} is used by the default camera aim")
        if references and not cascade:
            raise ValueError(f"scene point {point_id} is used by camera keyframes {references}")
        for keyframe_id in references:
            del draft.camera_track.keyframes[keyframe_id]
        del draft.scene_points[point_id]
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

    async def add_speed_keyframe(self, project_id: str, data: SpeedKeyframeCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        item = SpeedKeyframe(**data.model_dump())
        draft.motion_profile.keyframes[item.id] = item
        return await self._commit(draft, expected)

    async def update_motion_profile(self, project_id: str, data: MotionProfileUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.motion_profile.default_speed = data.default_speed
        return await self._commit(draft, expected)

    async def update_speed_keyframe(
        self, project_id: str, keyframe_id: str, data: SpeedKeyframeUpdate
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.motion_profile.keyframes:
            raise KeyError(f"speed keyframe {keyframe_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        old = draft.motion_profile.keyframes[keyframe_id]
        draft.motion_profile.keyframes[keyframe_id] = old.model_copy(update=patch)
        return await self._commit(draft, expected)

    async def delete_speed_keyframe(self, project_id: str, keyframe_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.motion_profile.keyframes:
            raise KeyError(f"speed keyframe {keyframe_id} not found")
        del draft.motion_profile.keyframes[keyframe_id]
        return await self._commit(draft, expected)

    async def add_camera_keyframe(self, project_id: str, data: CameraKeyframeCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        item = CameraKeyframe(**data.model_dump())
        draft.camera_track.keyframes[item.id] = item
        return await self._commit(draft, expected)

    async def update_camera_track(self, project_id: str, data: CameraTrackUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        merged = {**draft.camera_track.model_dump(), **patch}
        draft.camera_track = draft.camera_track.__class__.model_validate(merged)
        return await self._commit(draft, expected)

    async def update_camera_keyframe(
        self, project_id: str, keyframe_id: str, data: CameraKeyframeUpdate
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.keyframes:
            raise KeyError(f"camera keyframe {keyframe_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        old = draft.camera_track.keyframes[keyframe_id]
        draft.camera_track.keyframes[keyframe_id] = old.__class__.model_validate(
            {**old.model_dump(), **patch}
        )
        return await self._commit(draft, expected)

    async def delete_camera_keyframe(self, project_id: str, keyframe_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.keyframes:
            raise KeyError(f"camera keyframe {keyframe_id} not found")
        del draft.camera_track.keyframes[keyframe_id]
        return await self._commit(draft, expected)

    async def compile(self, project_id: str) -> CompiledTrajectory:
        return self.compile_draft(await self.repository.get(project_id))

    def compile_draft(self, project: Project) -> CompiledTrajectory:
        return compile_project(project, tolerance=self.compile_tolerance)
