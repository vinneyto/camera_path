from camera_path.models import (
    AimTimeline,
    CameraKeyframe,
    CameraKeyframeCreate,
    CameraKeyframeUpdate,
    CameraOrientation,
    CameraOrientationKeyframe,
    CameraOrientationKeyframeCreate,
    CameraOrientationKeyframeUpdate,
    CameraTrack,
    CameraTrackUpdate,
    DepthOfFieldKeyframe,
    DepthOfFieldKeyframeCreate,
    DepthOfFieldKeyframeUpdate,
    DepthOfFieldTimeline,
    MotionProfileUpdate,
    OrientationTimeline,
    Project,
    SpeedKeyframe,
    SpeedKeyframeCreate,
    SpeedKeyframeUpdate,
    new_id,
)
from camera_path.repositories.aim_timeline import AimTimelineRepository
from camera_path.repositories.camera_track import CameraTrackRepository
from camera_path.repositories.depth_of_field_timeline import DepthOfFieldTimelineRepository
from camera_path.repositories.orientation_timeline import OrientationTimelineRepository
from camera_path.repositories.speed_timeline import SpeedTimelineRepository
from camera_path.services.base import ServiceBase


class TimelineService(ServiceBase):
    async def _save_speed(self, draft: Project, expected: int) -> Project:
        async with self._transaction(draft, expected) as session:
            await SpeedTimelineRepository(session).replace(draft.id, draft.motion_profile)
        return draft

    async def _save_aim(self, draft: Project, expected: int) -> Project:
        async with self._transaction(draft, expected) as session:
            await CameraTrackRepository(session).set_aim(
                draft.id, draft.camera_track.default_aim, draft.camera_track.world_up
            )
            await AimTimelineRepository(session).replace(
                draft.id,
                AimTimeline(
                    default_aim=draft.camera_track.default_aim,
                    world_up=draft.camera_track.world_up,
                    keyframes=draft.camera_track.keyframes,
                ),
            )
        return draft

    async def _save_orientation(self, draft: Project, expected: int) -> Project:
        async with self._transaction(draft, expected) as session:
            await CameraTrackRepository(session).set_orientation(
                draft.id, draft.camera_track.default_orientation
            )
            await OrientationTimelineRepository(session).replace(
                draft.id,
                OrientationTimeline(
                    default_orientation=draft.camera_track.default_orientation,
                    keyframes=draft.camera_track.orientation_keyframes,
                ),
            )
        return draft

    async def _save_depth_of_field(self, draft: Project, expected: int) -> Project:
        async with self._transaction(draft, expected) as session:
            await DepthOfFieldTimelineRepository(session).replace(
                draft.id,
                DepthOfFieldTimeline(keyframes=draft.camera_track.depth_of_field_keyframes),
            )
        return draft

    async def add_speed_keyframe(self, project_id: str, data: SpeedKeyframeCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        item = SpeedKeyframe(id=new_id(), **data.model_dump())
        draft.motion_profile.keyframes[item.id] = item
        return await self._save_speed(draft, expected)

    async def update_motion_profile(self, project_id: str, data: MotionProfileUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.motion_profile.default_speed = data.default_speed
        return await self._save_speed(draft, expected)

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
        return await self._save_speed(draft, expected)

    async def delete_speed_keyframe(self, project_id: str, keyframe_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.motion_profile.keyframes:
            raise KeyError(f"speed keyframe {keyframe_id} not found")
        del draft.motion_profile.keyframes[keyframe_id]
        return await self._save_speed(draft, expected)

    async def add_camera_keyframe(self, project_id: str, data: CameraKeyframeCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        item = CameraKeyframe(id=new_id(), **data.model_dump())
        draft.camera_track.keyframes[item.id] = item
        return await self._save_aim(draft, expected)

    async def update_camera_track(self, project_id: str, data: CameraTrackUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        merged = {**draft.camera_track.model_dump(), **patch}
        draft.camera_track = CameraTrack.model_validate(merged)
        return await self._save_aim(draft, expected)

    async def update_default_camera_orientation(
        self, project_id: str, data: CameraOrientation
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.camera_track.default_orientation = data
        return await self._save_orientation(draft, expected)

    async def add_camera_orientation_keyframe(
        self, project_id: str, data: CameraOrientationKeyframeCreate
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        item = CameraOrientationKeyframe(id=new_id(), **data.model_dump())
        draft.camera_track.orientation_keyframes[item.id] = item
        return await self._save_orientation(draft, expected)

    async def update_camera_orientation_keyframe(
        self,
        project_id: str,
        keyframe_id: str,
        data: CameraOrientationKeyframeUpdate,
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.orientation_keyframes:
            raise KeyError(f"camera orientation keyframe {keyframe_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        old = draft.camera_track.orientation_keyframes[keyframe_id]
        draft.camera_track.orientation_keyframes[keyframe_id] = old.__class__.model_validate(
            {**old.model_dump(), **patch}
        )
        return await self._save_orientation(draft, expected)

    async def add_depth_of_field_keyframe(
        self, project_id: str, data: DepthOfFieldKeyframeCreate
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        item = DepthOfFieldKeyframe(id=new_id(), **data.model_dump())
        draft.camera_track.depth_of_field_keyframes[item.id] = item
        return await self._save_depth_of_field(draft, expected)

    async def update_depth_of_field_keyframe(
        self,
        project_id: str,
        keyframe_id: str,
        data: DepthOfFieldKeyframeUpdate,
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.depth_of_field_keyframes:
            raise KeyError(f"depth of field keyframe {keyframe_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        old = draft.camera_track.depth_of_field_keyframes[keyframe_id]
        draft.camera_track.depth_of_field_keyframes[keyframe_id] = old.__class__.model_validate(
            {**old.model_dump(), **patch}
        )
        return await self._save_depth_of_field(draft, expected)

    async def delete_depth_of_field_keyframe(self, project_id: str, keyframe_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.depth_of_field_keyframes:
            raise KeyError(f"depth of field keyframe {keyframe_id} not found")
        del draft.camera_track.depth_of_field_keyframes[keyframe_id]
        return await self._save_depth_of_field(draft, expected)

    async def delete_camera_orientation_keyframe(
        self, project_id: str, keyframe_id: str
    ) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.orientation_keyframes:
            raise KeyError(f"camera orientation keyframe {keyframe_id} not found")
        del draft.camera_track.orientation_keyframes[keyframe_id]
        return await self._save_orientation(draft, expected)

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
        return await self._save_aim(draft, expected)

    async def delete_camera_keyframe(self, project_id: str, keyframe_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if keyframe_id not in draft.camera_track.keyframes:
            raise KeyError(f"camera keyframe {keyframe_id} not found")
        del draft.camera_track.keyframes[keyframe_id]
        return await self._save_aim(draft, expected)
