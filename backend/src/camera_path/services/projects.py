from camera_path.models import (
    Anchor,
    AnchorCreate,
    AnchorUpdate,
    LookAtPointAim,
    Project,
    ProjectCreate,
    ProjectUpdate,
    ScenePoint,
    ScenePointCreate,
    ScenePointDepthOfFieldFocus,
    ScenePointUpdate,
    SplineSegment,
)
from camera_path.services.base import ServiceBase


class ProjectService(ServiceBase):
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

    async def reset_project(self, project_id: str) -> Project:
        current = await self.repository.get(project_id)
        draft = Project(id=current.id, name=current.name, revision=current.revision)
        return await self._commit(draft, current.revision)

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
