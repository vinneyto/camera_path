from camera_path.models import CompiledTrajectory, Project
from camera_path.repository import ProjectRepository
from camera_path.trajectory import compile_project, validate_project


class ServiceBase:
    def __init__(self, repository: ProjectRepository, compile_tolerance: float = 1e-3) -> None:
        self.repository = repository
        self.compile_tolerance = compile_tolerance

    async def _commit(self, draft: Project, expected: int) -> Project:
        validate_project(draft)
        return await self.repository.commit(draft, expected)

    async def commit_draft(self, draft: Project, expected_revision: int) -> Project:
        self.compile_draft(draft)
        return await self.repository.commit(draft, expected_revision)

    def compile_draft(self, project: Project) -> CompiledTrajectory:
        return compile_project(project, tolerance=self.compile_tolerance)
