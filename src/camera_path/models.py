from __future__ import annotations

from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

Vec3 = tuple[float, float, float]


class AnchorCreate(BaseModel):
    label: str = Field(min_length=1, max_length=64)
    surface_position: Vec3
    surface_normal: Vec3 = (0.0, 1.0, 0.0)
    lift: float = 0.0
    lift_axis: Literal["world_up", "surface_normal"] = "world_up"

    @field_validator("surface_normal")
    @classmethod
    def normal_must_be_nonzero(cls, value: Vec3) -> Vec3:
        if sum(component * component for component in value) < 1e-16:
            raise ValueError("surface_normal must be non-zero")
        return value


class Anchor(AnchorCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))


class SplineSegmentCreate(BaseModel):
    anchor_ids: list[str] = Field(min_length=2)
    tension: float = Field(default=0.0, ge=0.0, le=1.0)


class SplineSegment(SplineSegmentCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    kind: Literal["spline"] = "spline"


class SpiralSegmentCreate(BaseModel):
    start_anchor_id: str
    center_anchor_id: str
    end_anchor_id: str
    turns: float = Field(default=1.0, gt=0.0, le=100.0)
    direction: Literal["cw", "ccw"] = "ccw"
    radial_law: Literal["linear", "smoothstep"] = "smoothstep"
    axial_law: Literal["linear", "smoothstep"] = "smoothstep"


class SpiralSegment(SpiralSegmentCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    kind: Literal["spiral"] = "spiral"


TrajectorySegment = Annotated[SplineSegment | SpiralSegment, Field(discriminator="kind")]


class CameraTrack(BaseModel):
    orientation_mode: Literal["follow_tangent", "look_at_anchor"] = "follow_tangent"
    look_at_anchor_id: str | None = None
    world_up: Vec3 = (0.0, 1.0, 0.0)


class MotionProfile(BaseModel):
    mode: Literal["constant_speed"] = "constant_speed"
    speed: float = Field(default=1.0, gt=0.0)


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(default="Untitled camera path", min_length=1, max_length=128)
    revision: int = 0
    anchors: dict[str, Anchor] = Field(default_factory=dict)
    segments: list[TrajectorySegment] = Field(default_factory=list)
    camera_track: CameraTrack = Field(default_factory=CameraTrack)
    motion_profile: MotionProfile = Field(default_factory=MotionProfile)


class ProjectCreate(BaseModel):
    name: str = Field(default="Untitled camera path", min_length=1, max_length=128)


class CubicBezier3D(BaseModel):
    source_segment_id: str
    p0: Vec3
    p1: Vec3
    p2: Vec3
    p3: Vec3
    length: float


class ArcLengthSample(BaseModel):
    segment_index: int
    t: float
    distance: float


class CompiledTrajectory(BaseModel):
    project_id: str
    revision: int
    position_segments: list[CubicBezier3D]
    arc_length_table: list[ArcLengthSample]
    total_length: float
    duration_seconds: float
    warnings: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)


class ChatResult(BaseModel):
    answer: str
    project: Project
    compiled: CompiledTrajectory
