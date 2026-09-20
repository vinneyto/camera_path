from camera_path.models import (
    LookAtPointAim,
    Project,
    ScenePoint,
    ScenePointCreate,
    ScenePointDepthOfFieldFocus,
    ScenePointUpdate,
)
from camera_path.services.base import ServiceBase


class ScenePointService(ServiceBase):
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
        depth_of_field_references = [
            item.id
            for item in draft.camera_track.depth_of_field_keyframes.values()
            if isinstance(item.focus, ScenePointDepthOfFieldFocus)
            and item.focus.scene_point_id == point_id
        ]
        default_references = (
            isinstance(draft.camera_track.default_aim, LookAtPointAim)
            and draft.camera_track.default_aim.scene_point_id == point_id
        )
        if default_references:
            raise ValueError(f"scene point {point_id} is used by the default camera aim")
        all_references = references + depth_of_field_references
        if all_references and not cascade:
            raise ValueError(
                f"scene point {point_id} is used by camera or depth of field keyframes "
                f"{all_references}"
            )
        for keyframe_id in references:
            del draft.camera_track.keyframes[keyframe_id]
        for keyframe_id in depth_of_field_references:
            del draft.camera_track.depth_of_field_keyframes[keyframe_id]
        del draft.scene_points[point_id]
        return await self._commit(draft, expected)
