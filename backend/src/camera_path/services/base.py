from camera_path.models import Project
from camera_path.repositories import ProjectRepositoryProtocol
from camera_path.trajectory import validate_project


class ServiceBase:
    def __init__(self, repository: ProjectRepositoryProtocol) -> None:
        self.repository = repository

    async def _commit(self, draft: Project, expected: int) -> Project:
        validate_project(draft)
        return await self.repository.commit(draft, expected)
