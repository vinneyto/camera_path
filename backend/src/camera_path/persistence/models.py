from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, composite, mapped_column, relationship


@dataclass(frozen=True)
class Vector3:
    x: float
    y: float
    z: float

    def as_tuple(self) -> tuple[float, float, float]:
        return self.x, self.y, self.z


class Base(DeclarativeBase):
    pass


class ProjectRecord(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class LibraryAssetRecord(Base):
    __tablename__ = "library_assets"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


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
    label: Mapped[str] = mapped_column(Text, nullable=False)
    surface_position: Mapped[Vector3] = composite(
        mapped_column("surface_position_x", Float, nullable=False),
        mapped_column("surface_position_y", Float, nullable=False),
        mapped_column("surface_position_z", Float, nullable=False),
    )
    surface_normal: Mapped[Vector3] = composite(
        mapped_column("surface_normal_x", Float, nullable=False),
        mapped_column("surface_normal_y", Float, nullable=False),
        mapped_column("surface_normal_z", Float, nullable=False),
    )
    lift: Mapped[float] = mapped_column(Float, nullable=False)
    lift_axis: Mapped[str] = mapped_column(Text, nullable=False)


class ScenePointRecord(ProjectChildRecord, Base):
    __tablename__ = "scene_points"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[Vector3] = composite(
        mapped_column("position_x", Float, nullable=False),
        mapped_column("position_y", Float, nullable=False),
        mapped_column("position_z", Float, nullable=False),
    )


class TrajectorySegmentRecord(ProjectChildRecord, Base):
    __tablename__ = "trajectory_segments"
    __table_args__ = (
        UniqueConstraint("project_id", "position", name="uq_trajectory_segments_position"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    tension: Mapped[float | None] = mapped_column(Float)
    turns: Mapped[float | None] = mapped_column(Float)
    direction: Mapped[str | None] = mapped_column(Text)
    radial_law: Mapped[str | None] = mapped_column(Text)
    axial_law: Mapped[str | None] = mapped_column(Text)
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
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float] = mapped_column(Float, nullable=False)
    interpolation_to_next: Mapped[str] = mapped_column(Text, nullable=False)


class CameraTrackRecord(Base):
    __tablename__ = "camera_tracks"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    default_aim_kind: Mapped[str] = mapped_column(Text, nullable=False)
    default_aim_direction: Mapped[str | None] = mapped_column(Text)
    default_aim_scene_point_id: Mapped[str | None] = mapped_column(Text)
    world_up: Mapped[Vector3] = composite(
        mapped_column("world_up_x", Float, nullable=False),
        mapped_column("world_up_y", Float, nullable=False),
        mapped_column("world_up_z", Float, nullable=False),
    )
    default_orientation_yaw_deg: Mapped[float] = mapped_column(Float, nullable=False)
    default_orientation_pitch_deg: Mapped[float] = mapped_column(Float, nullable=False)
    default_orientation_roll_deg: Mapped[float] = mapped_column(Float, nullable=False)


class AimKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "aim_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    aim_kind: Mapped[str] = mapped_column(Text, nullable=False)
    aim_direction: Mapped[str | None] = mapped_column(Text)
    aim_scene_point_id: Mapped[str | None] = mapped_column(Text)
    interpolation_to_next: Mapped[str] = mapped_column(Text, nullable=False)


class OrientationKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "orientation_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    yaw_deg: Mapped[float] = mapped_column(Float, nullable=False)
    pitch_deg: Mapped[float] = mapped_column(Float, nullable=False)
    roll_deg: Mapped[float] = mapped_column(Float, nullable=False)
    interpolation_to_next: Mapped[str] = mapped_column(Text, nullable=False)


class DepthOfFieldKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "depth_of_field_keyframes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    focus_kind: Mapped[str] = mapped_column(Text, nullable=False)
    focus_scene_point_id: Mapped[str | None] = mapped_column(Text)
    focus_range_scale: Mapped[float] = mapped_column(Float, nullable=False)
    bokeh_scale: Mapped[float] = mapped_column(Float, nullable=False)


class ChatMessageRecord(ProjectChildRecord, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (UniqueConstraint("project_id", "position", name="uq_chat_messages_position"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
