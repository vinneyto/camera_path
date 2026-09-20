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
    AimKeyframeRecord,
    AnchorRecord,
    Base,
    ChatMessageRecord,
    DepthOfFieldKeyframeRecord,
    MotionProfileRecord,
    OrientationKeyframeRecord,
    ProjectRecord,
    ScenePointRecord,
    SpeedKeyframeRecord,
    TrajectorySegmentRecord,
)
from camera_path.repositories.exceptions import ProjectNotFoundError, RevisionConflictError
from camera_path.repositories.sqlalchemy_aim_timeline import SQLAlchemyAimTimelineRepository
from camera_path.repositories.sqlalchemy_anchor import SQLAlchemyAnchorRepository
from camera_path.repositories.sqlalchemy_chat_message import SQLAlchemyChatMessageRepository
from camera_path.repositories.sqlalchemy_depth_of_field_timeline import (
    SQLAlchemyDepthOfFieldTimelineRepository,
)
from camera_path.repositories.sqlalchemy_orientation_timeline import (
    SQLAlchemyOrientationTimelineRepository,
)
from camera_path.repositories.sqlalchemy_scene_point import SQLAlchemyScenePointRepository
from camera_path.repositories.sqlalchemy_speed_timeline import SQLAlchemySpeedTimelineRepository
from camera_path.repositories.sqlalchemy_trajectory import SQLAlchemyTrajectoryRepository


class SQLAlchemyProjectRepository:
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
            session.add(
                ProjectRecord(id=project.id, name=project.name, revision=project.revision)
            )
            await session.flush()
            await self._replace_resources(session, project)
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

    async def commit(self, draft: Project, expected_revision: int) -> Project:
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
            await self._replace_resources(session, committed)
        return committed.model_copy(deep=True)

    async def _load(self, session: AsyncSession, project_id: str) -> Project:
        record = await session.get(ProjectRecord, project_id)
        if record is None:
            raise ProjectNotFoundError(project_id)

        anchors = await SQLAlchemyAnchorRepository(session).list(project_id)
        scene_points = await SQLAlchemyScenePointRepository(session).list(project_id)
        segments = await SQLAlchemyTrajectoryRepository(session).get(project_id)
        motion_profile = await SQLAlchemySpeedTimelineRepository(session).get(project_id)
        aim = await SQLAlchemyAimTimelineRepository(session).get(project_id)
        orientation = await SQLAlchemyOrientationTimelineRepository(session).get(project_id)
        depth_of_field = await SQLAlchemyDepthOfFieldTimelineRepository(session).get(project_id)
        chat_history = await SQLAlchemyChatMessageRepository(session).list(project_id)

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
    async def _replace_resources(session: AsyncSession, project: Project) -> None:
        # Clear dependants first so RESTRICT references are never left dangling mid-transaction.
        for record in (
            TrajectorySegmentRecord,
            AimKeyframeRecord,
            OrientationKeyframeRecord,
            DepthOfFieldKeyframeRecord,
            SpeedKeyframeRecord,
            ChatMessageRecord,
            AnchorRecord,
            ScenePointRecord,
        ):
            await session.execute(delete(record).where(record.project_id == project.id))
        await session.execute(
            delete(MotionProfileRecord).where(MotionProfileRecord.project_id == project.id)
        )
        await session.flush()

        await SQLAlchemyAnchorRepository(session).replace(project.id, project.anchors)
        await SQLAlchemyScenePointRepository(session).replace(project.id, project.scene_points)
        await SQLAlchemyTrajectoryRepository(session).replace(project.id, project.segments)
        await SQLAlchemySpeedTimelineRepository(session).replace(
            project.id, project.motion_profile
        )
        await SQLAlchemyAimTimelineRepository(session).replace(
            project.id,
            AimTimeline(
                default_aim=project.camera_track.default_aim,
                keyframes=project.camera_track.keyframes,
                world_up=project.camera_track.world_up,
            ),
        )
        await SQLAlchemyOrientationTimelineRepository(session).replace(
            project.id,
            OrientationTimeline(
                default_orientation=project.camera_track.default_orientation,
                keyframes=project.camera_track.orientation_keyframes,
            ),
        )
        await SQLAlchemyDepthOfFieldTimelineRepository(session).replace(
            project.id,
            DepthOfFieldTimeline(keyframes=project.camera_track.depth_of_field_keyframes),
        )
        await SQLAlchemyChatMessageRepository(session).replace(project.id, project.chat_history)
