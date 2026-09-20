from camera_path.models import Project, ProjectCreate, ProjectUpdate
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
