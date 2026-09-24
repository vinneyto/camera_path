from __future__ import annotations

import asyncio

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import (
    AimTimeline,
    CameraTrack,
    DepthOfFieldTimeline,
    OrientationTimeline,
    Project,
)
from camera_path.persistence.database import create_engine_and_session_factory
from camera_path.persistence.models import (
    Base,
    ProjectCloudRecord,
    ProjectRecord,
)
from camera_path.repositories.aim_timeline import AimTimelineRepository
from camera_path.repositories.anchor import AnchorRepository
from camera_path.repositories.camera_track import CameraTrackRepository
from camera_path.repositories.chat_message import ChatMessageRepository
from camera_path.repositories.depth_of_field_timeline import (
    DepthOfFieldTimelineRepository,
)
from camera_path.repositories.exceptions import ProjectNotFoundError, RevisionConflictError
from camera_path.repositories.orientation_timeline import (
    OrientationTimelineRepository,
)
from camera_path.repositories.scene_point import ScenePointRepository
from camera_path.repositories.speed_timeline import SpeedTimelineRepository
from camera_path.repositories.trajectory import TrajectoryRepository


class ProjectRepository:
    """Compatibility aggregate assembled from normalized resource repositories."""

    def __init__(self, database_url: str) -> None:
        self.engine, self.session_factory = create_engine_and_session_factory(database_url)
        self._initialized = False
        self._initialize_lock = asyncio.Lock()

    async def initialize(self) -> None:
        if self._initialized:
            return
        async with self._initialize_lock:
            if self._initialized:
                return
            async with self.engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            self._initialized = True

    async def close(self) -> None:
        await self.engine.dispose()

    async def create(self, project: Project) -> Project:
        await self.initialize()
        async with self.session_factory.begin() as session:
            session.add(ProjectRecord(id=project.id, name=project.name, revision=project.revision))
            await session.flush()
            await self._insert_resources(session, project)
        return project.model_copy(deep=True)

    async def get(self, project_id: str) -> Project:
        await self.initialize()
        async with self.session_factory() as session:
            return (await self._load(session, project_id)).model_copy(deep=True)

    async def list(self) -> list[Project]:
        await self.initialize()
        async with self.session_factory() as session:
            ids = list(await session.scalars(select(ProjectRecord.id).order_by(ProjectRecord.id)))
            return [await self._load(session, project_id) for project_id in ids]

    async def delete(self, project_id: str) -> None:
        await self.initialize()
        async with self.session_factory.begin() as session:
            result = await session.execute(
                delete(ProjectRecord).where(ProjectRecord.id == project_id)
            )
            if result.rowcount == 0:
                raise ProjectNotFoundError(project_id)

    async def commit(
        self, draft: Project, expected_revision: int, *, clear_clouds: bool = False
    ) -> Project:
        await self.initialize()
        async with self.session_factory.begin() as session:
            next_revision = expected_revision + 1
            changed = await session.execute(
                update(ProjectRecord)
                .where(
                    ProjectRecord.id == draft.id,
                    ProjectRecord.revision == expected_revision,
                )
                .values(name=draft.name, revision=next_revision)
            )
            if changed.rowcount != 1:
                current = await session.scalar(
                    select(ProjectRecord.revision).where(ProjectRecord.id == draft.id)
                )
                if current is None:
                    raise ProjectNotFoundError(draft.id)
                raise RevisionConflictError(
                    f"expected revision {expected_revision}, current revision is {current}"
                )
            committed = draft.model_copy(deep=True)
            committed.revision = next_revision
            previous = await self._load(session, draft.id)
            if clear_clouds:
                await session.execute(
                    delete(ProjectCloudRecord).where(ProjectCloudRecord.project_id == draft.id)
                )
            await self._sync_project_changes(session, previous, committed)
        return committed.model_copy(deep=True)

    async def _load(self, session: AsyncSession, project_id: str) -> Project:
        record = await session.get(ProjectRecord, project_id)
        if record is None:
            raise ProjectNotFoundError(project_id)

        anchors = await AnchorRepository(session).list(project_id)
        scene_points = await ScenePointRepository(session).list(project_id)
        segments = await TrajectoryRepository(session).get(project_id)
        motion_profile = await SpeedTimelineRepository(session).get(project_id)
        aim = await AimTimelineRepository(session).get(project_id)
        orientation = await OrientationTimelineRepository(session).get(project_id)
        depth_of_field = await DepthOfFieldTimelineRepository(session).get(project_id)
        chat_history = await ChatMessageRepository(session).list(project_id)

        return Project(
            id=record.id,
            name=record.name,
            revision=record.revision,
            anchors=anchors,
            scene_points=scene_points,
            segments=segments,
            motion_profile=motion_profile,
            camera_track=CameraTrack(
                default_aim=aim.default_aim,
                keyframes=aim.keyframes,
                world_up=aim.world_up,
                default_orientation=orientation.default_orientation,
                orientation_keyframes=orientation.keyframes,
                depth_of_field_keyframes=depth_of_field.keyframes,
            ),
            chat_history=chat_history,
        )

    @staticmethod
    async def _insert_resources(session: AsyncSession, project: Project) -> None:
        await CameraTrackRepository(session).create(project.id, project.camera_track)

        await AnchorRepository(session).replace(project.id, project.anchors)
        await ScenePointRepository(session).replace(project.id, project.scene_points)
        await TrajectoryRepository(session).replace(project.id, project.segments)
        await SpeedTimelineRepository(session).replace(project.id, project.motion_profile)
        await AimTimelineRepository(session).replace(
            project.id,
            AimTimeline(
                default_aim=project.camera_track.default_aim,
                keyframes=project.camera_track.keyframes,
                world_up=project.camera_track.world_up,
            ),
        )
        await OrientationTimelineRepository(session).replace(
            project.id,
            OrientationTimeline(
                default_orientation=project.camera_track.default_orientation,
                keyframes=project.camera_track.orientation_keyframes,
            ),
        )
        await DepthOfFieldTimelineRepository(session).replace(
            project.id,
            DepthOfFieldTimeline(keyframes=project.camera_track.depth_of_field_keyframes),
        )
        await ChatMessageRepository(session).replace(project.id, project.chat_history)

    @staticmethod
    async def _sync_project_changes(session: AsyncSession, before: Project, after: Project) -> None:
        """Compatibility for aggregate clients; services write named resources."""
        project_id = after.id
        # New targets must exist before segment anchors and camera references are written.
        if before.anchors != after.anchors:
            await AnchorRepository(session).replace(
                project_id,
                {
                    **before.anchors,
                    **after.anchors,
                },
            )
        if before.scene_points != after.scene_points:
            await ScenePointRepository(session).replace(
                project_id,
                {
                    **before.scene_points,
                    **after.scene_points,
                },
            )
        await session.flush()

        if before.camera_track.default_aim != after.camera_track.default_aim or (
            before.camera_track.world_up != after.camera_track.world_up
        ):
            await CameraTrackRepository(session).set_aim(
                project_id, after.camera_track.default_aim, after.camera_track.world_up
            )
        if before.camera_track.default_orientation != after.camera_track.default_orientation:
            await CameraTrackRepository(session).set_orientation(
                project_id, after.camera_track.default_orientation
            )
        if before.segments != after.segments:
            await TrajectoryRepository(session).replace(project_id, after.segments)
        if before.motion_profile != after.motion_profile:
            await SpeedTimelineRepository(session).replace(project_id, after.motion_profile)
        if before.camera_track.keyframes != after.camera_track.keyframes:
            await AimTimelineRepository(session).replace(
                project_id,
                AimTimeline(
                    default_aim=after.camera_track.default_aim,
                    world_up=after.camera_track.world_up,
                    keyframes=after.camera_track.keyframes,
                ),
            )
        if before.camera_track.orientation_keyframes != after.camera_track.orientation_keyframes:
            await OrientationTimelineRepository(session).replace(
                project_id,
                OrientationTimeline(
                    default_orientation=after.camera_track.default_orientation,
                    keyframes=after.camera_track.orientation_keyframes,
                ),
            )
        if (
            before.camera_track.depth_of_field_keyframes
            != after.camera_track.depth_of_field_keyframes
        ):
            await DepthOfFieldTimelineRepository(session).replace(
                project_id,
                DepthOfFieldTimeline(keyframes=after.camera_track.depth_of_field_keyframes),
            )
        await session.flush()
        if before.anchors != after.anchors:
            await AnchorRepository(session).replace(project_id, after.anchors)
        if before.scene_points != after.scene_points:
            await ScenePointRepository(session).replace(project_id, after.scene_points)
        if before.chat_history != after.chat_history:
            await ChatMessageRepository(session).replace(project_id, after.chat_history)
