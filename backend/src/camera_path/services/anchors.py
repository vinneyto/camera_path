from camera_path.models import Anchor, AnchorCreate, AnchorUpdate, Project, SplineSegment, new_id
from camera_path.repositories.anchor import AnchorRepository
from camera_path.services.base import ServiceBase


class AnchorService(ServiceBase):
    async def _save_anchors(self, draft: Project, expected: int) -> Project:
        async with self._transaction(draft, expected) as session:
            await AnchorRepository(session).replace(draft.id, draft.anchors)
        return draft

    async def add_anchor(self, project_id: str, data: AnchorCreate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        anchor = Anchor(id=new_id(), **data.model_dump())
        draft.anchors[anchor.id] = anchor
        return await self._save_anchors(draft, expected)

    async def update_anchor(self, project_id: str, anchor_id: str, data: AnchorUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        if anchor_id not in draft.anchors:
            raise KeyError(f"anchor {anchor_id} not found")
        patch = data.model_dump(exclude_unset=True, exclude_none=True)
        draft.anchors[anchor_id] = draft.anchors[anchor_id].model_copy(update=patch)
        return await self._save_anchors(draft, expected)

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
        return await self._save_anchors(draft, expected)
