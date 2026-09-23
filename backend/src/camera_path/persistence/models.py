from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ProjectRecord(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ProjectChildRecord:
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )


class ProjectScopedKeyframeRecord:
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class AnchorRecord(ProjectChildRecord, Base):
    __tablename__ = "anchors"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class ScenePointRecord(ProjectChildRecord, Base):
    __tablename__ = "scene_points"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class TrajectorySegmentRecord(ProjectChildRecord, Base):
    __tablename__ = "trajectory_segments"
    __table_args__ = (
        UniqueConstraint("project_id", "position", name="uq_trajectory_segments_position"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    anchors: Mapped[list[SegmentAnchorRecord]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )


class SegmentAnchorRecord(Base):
    __tablename__ = "segment_anchors"

    segment_id: Mapped[str] = mapped_column(
        ForeignKey("trajectory_segments.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    anchor_id: Mapped[str] = mapped_column(
        ForeignKey("anchors.id", ondelete="RESTRICT"), nullable=False, index=True
    )


class MotionProfileRecord(Base):
    __tablename__ = "motion_profiles"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    default_speed: Mapped[float] = mapped_column(Float, nullable=False)


class SpeedKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "speed_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class CameraTrackRecord(Base):
    __tablename__ = "camera_tracks"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    default_aim: Mapped[str] = mapped_column(Text, nullable=False)
    world_up: Mapped[str] = mapped_column(Text, nullable=False)
    default_orientation: Mapped[str] = mapped_column(Text, nullable=False)


class AimKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "aim_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class OrientationKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "orientation_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class DepthOfFieldKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "depth_of_field_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class ChatMessageRecord(ProjectChildRecord, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        UniqueConstraint("project_id", "position", name="uq_chat_messages_position"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
