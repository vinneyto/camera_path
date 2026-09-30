from sqlalchemy import delete

from camera_path.models import (
    AimTimeline,
    DepthOfFieldTimeline,
    OrientationTimeline,
    Project,
    ProjectCreate,
    ProjectMetadata,
    ProjectUpdate,
    new_id,
)
from camera_path.persistence.models import ProjectCloudRecord, ProjectRecord
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


class ProjectService(ServiceBase):
    async def create_project(self, data: ProjectCreate) -> Project:
        project = Project(id=new_id(), name=data.name)
        await self.repository.initialize()
        async with self.repository.session_factory.begin() as session:
            session.add(ProjectRecord(id=project.id, name=project.name, revision=0))
            await session.flush()
            await CameraTrackRepository(session).create(project.id, project.camera_track)
            await SpeedTimelineRepository(session).replace(project.id, project.motion_profile)
        return project

    async def list_projects(self) -> list[Project]:
        return await self.repository.list()

    async def list_project_metadata(self) -> list[ProjectMetadata]:
        return await self.repository.list_metadata()

    async def get_project_metadata(self, project_id: str) -> ProjectMetadata:
        return await self.repository.get_metadata(project_id)

    async def get_project(self, project_id: str) -> Project:
        return await self.repository.get(project_id)

    async def update_project(self, project_id: str, data: ProjectUpdate) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.name = data.name
        async with self._transaction(draft, expected) as session:
            record = await session.get(ProjectRecord, project_id)
            record.name = draft.name
        return draft

    async def delete_project(self, project_id: str) -> None:
        await self.repository.delete(project_id)

    async def reset_project(self, project_id: str) -> Project:
        current = await self.repository.get(project_id)
        draft = Project(id=current.id, name=current.name, revision=current.revision)
        async with self._transaction(draft, current.revision) as session:
            await session.execute(
                delete(ProjectCloudRecord).where(ProjectCloudRecord.project_id == project_id)
            )
            await CameraTrackRepository(session).set_aim(
                project_id, draft.camera_track.default_aim, draft.camera_track.world_up
            )
            await CameraTrackRepository(session).set_orientation(
                project_id, draft.camera_track.default_orientation
            )
            await AimTimelineRepository(session).replace(project_id, AimTimeline())
            await OrientationTimelineRepository(session).replace(project_id, OrientationTimeline())
            await DepthOfFieldTimelineRepository(session).replace(
                project_id, DepthOfFieldTimeline()
            )
            await TrajectoryRepository(session).replace(project_id, [])
            await session.flush()
            await AnchorRepository(session).replace(project_id, {})
            await ScenePointRepository(session).replace(project_id, {})
            await SpeedTimelineRepository(session).replace(project_id, draft.motion_profile)
            await ChatMessageRepository(session).replace(project_id, [])
        return draft
