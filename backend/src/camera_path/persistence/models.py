from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, composite, mapped_column, relationship

from camera_path.models import (
    CameraAim,
    CameraOrientation,
    FollowPathAim,
    Interpolation,
    LookAtPointAim,
)

AimKind = Literal["follow_path", "look_at_point"]
AimDirection = Literal["forward", "backward"]
SpiralDirection = Literal["cw", "ccw"]
CurveLaw = Literal["linear", "smoothstep"]


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


class ProjectCloudRecord(Base):
    __tablename__ = "project_clouds"
    __table_args__ = (UniqueConstraint("project_id", "position", name="uq_project_cloud_position"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    library_asset_id: Mapped[str] = mapped_column(
        ForeignKey("library_assets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    visible: Mapped[bool] = mapped_column(nullable=False, default=True)


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
    __table_args__ = (UniqueConstraint("project_id", "id", name="uq_scene_points_project_id_id"),)

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
        CheckConstraint("kind IN ('spline', 'spiral')", name="ck_segment_kind"),
        CheckConstraint(
            "(kind = 'spline' AND tension IS NOT NULL AND turns IS NULL "
            "AND direction IS NULL AND radial_law IS NULL AND axial_law IS NULL) OR "
            "(kind = 'spiral' AND tension IS NULL AND turns IS NOT NULL "
            "AND direction IS NOT NULL AND direction IN ('cw', 'ccw') "
            "AND radial_law IS NOT NULL AND radial_law IN ('linear', 'smoothstep') "
            "AND axial_law IS NOT NULL AND axial_law IN ('linear', 'smoothstep'))",
            name="ck_segment_fields",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[Literal["spline", "spiral"]] = mapped_column(Text, nullable=False)
    tension: Mapped[float | None] = mapped_column(Float)
    turns: Mapped[float | None] = mapped_column(Float)
    direction: Mapped[SpiralDirection | None] = mapped_column(Text)
    radial_law: Mapped[CurveLaw | None] = mapped_column(Text)
    axial_law: Mapped[CurveLaw | None] = mapped_column(Text)
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
    __table_args__ = (
        CheckConstraint(
            "interpolation_to_next IN ('hold', 'linear', 'smoothstep')",
            name="ck_speed_interpolation",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float] = mapped_column(Float, nullable=False)
    interpolation_to_next: Mapped[Interpolation] = mapped_column(Text, nullable=False)


class CameraTrackRecord(Base):
    __tablename__ = "camera_tracks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "default_aim_scene_point_id"],
            ["scene_points.project_id", "scene_points.id"],
            name="fk_camera_track_scene_point",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "(default_aim_kind = 'follow_path' AND default_aim_direction IS NOT NULL "
            "AND default_aim_direction IN "
            "('forward', 'backward') AND default_aim_scene_point_id IS NULL) OR "
            "(default_aim_kind = 'look_at_point' AND default_aim_direction IS NULL "
            "AND default_aim_scene_point_id IS NOT NULL)",
            name="ck_camera_track_aim",
        ),
    )

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    default_aim_kind: Mapped[AimKind] = mapped_column(Text, nullable=False)
    default_aim_direction: Mapped[AimDirection | None] = mapped_column(Text)
    default_aim_scene_point_id: Mapped[str | None] = mapped_column(Text)
    world_up: Mapped[Vector3] = composite(
        mapped_column("world_up_x", Float, nullable=False),
        mapped_column("world_up_y", Float, nullable=False),
        mapped_column("world_up_z", Float, nullable=False),
    )
    default_orientation_yaw_deg: Mapped[float] = mapped_column(Float, nullable=False)
    default_orientation_pitch_deg: Mapped[float] = mapped_column(Float, nullable=False)
    default_orientation_roll_deg: Mapped[float] = mapped_column(Float, nullable=False)

    def get_default_aim(self) -> CameraAim:
        if self.default_aim_kind == "follow_path":
            return FollowPathAim(direction=self.default_aim_direction)
        if self.default_aim_kind == "look_at_point":
            return LookAtPointAim(scene_point_id=self.default_aim_scene_point_id)
        raise ValueError(f"invalid default aim kind: {self.default_aim_kind}")

    def set_default_aim(self, aim: CameraAim) -> None:
        self.default_aim_kind = aim.kind
        self.default_aim_direction = aim.direction if isinstance(aim, FollowPathAim) else None
        self.default_aim_scene_point_id = (
            aim.scene_point_id if isinstance(aim, LookAtPointAim) else None
        )

    def get_default_orientation(self) -> CameraOrientation:
        return CameraOrientation(
            yaw_deg=self.default_orientation_yaw_deg,
            pitch_deg=self.default_orientation_pitch_deg,
            roll_deg=self.default_orientation_roll_deg,
        )

    def set_default_orientation(self, value: CameraOrientation) -> None:
        self.default_orientation_yaw_deg = value.yaw_deg
        self.default_orientation_pitch_deg = value.pitch_deg
        self.default_orientation_roll_deg = value.roll_deg


class AimKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "aim_keyframes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "aim_scene_point_id"],
            ["scene_points.project_id", "scene_points.id"],
            name="fk_aim_key_scene_point",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "(aim_kind = 'follow_path' AND aim_direction IS NOT NULL "
            "AND aim_direction IN ('forward', 'backward') "
            "AND aim_scene_point_id IS NULL) OR "
            "(aim_kind = 'look_at_point' AND aim_direction IS NULL "
            "AND aim_scene_point_id IS NOT NULL)",
            name="ck_aim_key_aim",
        ),
        CheckConstraint(
            "interpolation_to_next IN ('hold', 'linear', 'smoothstep')", name="ck_aim_interpolation"
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    aim_kind: Mapped[AimKind] = mapped_column(Text, nullable=False)
    aim_direction: Mapped[AimDirection | None] = mapped_column(Text)
    aim_scene_point_id: Mapped[str | None] = mapped_column(Text)
    interpolation_to_next: Mapped[Interpolation] = mapped_column(Text, nullable=False)

    def get_aim(self) -> CameraAim:
        if self.aim_kind == "follow_path":
            return FollowPathAim(direction=self.aim_direction)
        if self.aim_kind == "look_at_point":
            return LookAtPointAim(scene_point_id=self.aim_scene_point_id)
        raise ValueError(f"invalid aim kind: {self.aim_kind}")

    def set_aim(self, aim: CameraAim) -> None:
        self.aim_kind = aim.kind
        self.aim_direction = aim.direction if isinstance(aim, FollowPathAim) else None
        self.aim_scene_point_id = aim.scene_point_id if isinstance(aim, LookAtPointAim) else None


class OrientationKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "orientation_keyframes"
    __table_args__ = (
        CheckConstraint(
            "interpolation_to_next IN ('hold', 'linear', 'smoothstep')",
            name="ck_orientation_interpolation",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    yaw_deg: Mapped[float] = mapped_column(Float, nullable=False)
    pitch_deg: Mapped[float] = mapped_column(Float, nullable=False)
    roll_deg: Mapped[float] = mapped_column(Float, nullable=False)
    interpolation_to_next: Mapped[Interpolation] = mapped_column(Text, nullable=False)

    def get_orientation(self) -> CameraOrientation:
        return CameraOrientation(
            yaw_deg=self.yaw_deg, pitch_deg=self.pitch_deg, roll_deg=self.roll_deg
        )

    def set_orientation(self, value: CameraOrientation) -> None:
        self.yaw_deg = value.yaw_deg
        self.pitch_deg = value.pitch_deg
        self.roll_deg = value.roll_deg


class DepthOfFieldKeyframeRecord(ProjectScopedKeyframeRecord, Base):
    __tablename__ = "depth_of_field_keyframes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "focus_scene_point_id"],
            ["scene_points.project_id", "scene_points.id"],
            name="fk_dof_scene_point",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "(focus_kind = 'center_weighted_9' AND focus_scene_point_id IS NULL) OR "
            "(focus_kind = 'scene_point' AND focus_scene_point_id IS NOT NULL)",
            name="ck_dof_focus",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    path_position: Mapped[float] = mapped_column(Float, nullable=False)
    focus_kind: Mapped[Literal["center_weighted_9", "scene_point"]] = mapped_column(
        Text, nullable=False
    )
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
