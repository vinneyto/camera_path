from camera_path.models import Project
from camera_path.services.base import ServiceBase


class HistoryService(ServiceBase):
    async def undo(self, project_id: str) -> Project:
        return await self.repository.undo(project_id)

    async def redo(self, project_id: str) -> Project:
        return await self.repository.redo(project_id)
