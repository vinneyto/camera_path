from __future__ import annotations

from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

Vec3 = tuple[float, float, float]
Interpolation = Literal["smoothstep", "linear", "hold"]


def new_id() -> str:
    return str(uuid4())


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
    id: str = Field(default_factory=new_id)


class AnchorUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=64)
    surface_position: Vec3 | None = None
    surface_normal: Vec3 | None = None
    lift: float | None = None
    lift_axis: Literal["world_up", "surface_normal"] | None = None

    @field_validator("surface_normal")
    @classmethod
    def normal_must_be_nonzero(cls, value: Vec3 | None) -> Vec3 | None:
        if value is not None and sum(component * component for component in value) < 1e-16:
            raise ValueError("surface_normal must be non-zero")
        return value


class ScenePointCreate(BaseModel):
    label: str = Field(min_length=1, max_length=64)
    position: Vec3


class ScenePoint(ScenePointCreate):
    id: str = Field(default_factory=new_id)


class ScenePointUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=64)
    position: Vec3 | None = None


class SplineSegmentCreate(BaseModel):
    anchor_ids: list[str] = Field(min_length=2)
    tension: float = Field(default=0.0, ge=0.0, le=1.0)


class SplineSegment(SplineSegmentCreate):
    id: str = Field(default_factory=new_id)
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
    id: str = Field(default_factory=new_id)
    kind: Literal["spiral"] = "spiral"


TrajectorySegment = Annotated[SplineSegment | SpiralSegment, Field(discriminator="kind")]


class FollowPathAim(BaseModel):
    kind: Literal["follow_path"] = "follow_path"
    direction: Literal["forward", "backward"] = "forward"


class LookAtPointAim(BaseModel):
    kind: Literal["look_at_point"] = "look_at_point"
    scene_point_id: str


CameraAim = Annotated[FollowPathAim | LookAtPointAim, Field(discriminator="kind")]


class CameraKeyframeCreate(BaseModel):
    path_position: float = Field(ge=0.0, le=1.0)
    aim: CameraAim
    interpolation_to_next: Interpolation = "smoothstep"


class CameraKeyframe(CameraKeyframeCreate):
    id: str = Field(default_factory=new_id)


class CameraKeyframeUpdate(BaseModel):
    path_position: float | None = Field(default=None, ge=0.0, le=1.0)
    aim: CameraAim | None = None
    interpolation_to_next: Interpolation | None = None


class CameraTrack(BaseModel):
    default_aim: CameraAim = Field(default_factory=FollowPathAim)
    keyframes: dict[str, CameraKeyframe] = Field(default_factory=dict)
    world_up: Vec3 = (0.0, 1.0, 0.0)


class CameraTrackUpdate(BaseModel):
    default_aim: CameraAim | None = None
    world_up: Vec3 | None = None


class SpeedKeyframeCreate(BaseModel):
    path_position: float = Field(ge=0.0, le=1.0)
    speed: float = Field(gt=0.0)
    interpolation_to_next: Interpolation = "smoothstep"


class SpeedKeyframe(SpeedKeyframeCreate):
    id: str = Field(default_factory=new_id)


class SpeedKeyframeUpdate(BaseModel):
    path_position: float | None = Field(default=None, ge=0.0, le=1.0)
    speed: float | None = Field(default=None, gt=0.0)
    interpolation_to_next: Interpolation | None = None


class MotionProfile(BaseModel):
    default_speed: float = Field(default=1.0, gt=0.0)
    keyframes: dict[str, SpeedKeyframe] = Field(default_factory=dict)


class MotionProfileUpdate(BaseModel):
    default_speed: float = Field(gt=0.0)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class Project(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str = Field(default="Untitled camera path", min_length=1, max_length=128)
    revision: int = 0
    anchors: dict[str, Anchor] = Field(default_factory=dict)
    scene_points: dict[str, ScenePoint] = Field(default_factory=dict)
    segments: list[TrajectorySegment] = Field(default_factory=list)
    camera_track: CameraTrack = Field(default_factory=CameraTrack)
    motion_profile: MotionProfile = Field(default_factory=MotionProfile)
    chat_history: list[ChatHistoryMessage] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    name: str = Field(default="Untitled camera path", min_length=1, max_length=128)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


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


class ResolvedLookAtPointAim(LookAtPointAim):
    position: Vec3


ResolvedCameraAim = Annotated[FollowPathAim | ResolvedLookAtPointAim, Field(discriminator="kind")]


class CompiledCameraKeyframe(BaseModel):
    id: str
    path_position: float
    aim: ResolvedCameraAim
    interpolation_to_next: Interpolation


class CompiledCameraTrack(BaseModel):
    default_aim: ResolvedCameraAim
    keyframes: list[CompiledCameraKeyframe]
    world_up: Vec3


class CompiledMotionProfile(BaseModel):
    default_speed: float
    keyframes: list[SpeedKeyframe]


class CompiledTrajectory(BaseModel):
    project_id: str
    revision: int
    position_segments: list[CubicBezier3D]
    arc_length_table: list[ArcLengthSample]
    total_length: float
    duration_seconds: float
    motion_profile: CompiledMotionProfile
    camera_track: CompiledCameraTrack
    warnings: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)


class ChatResult(BaseModel):
    answer: str
    project: Project
    compiled: CompiledTrajectory
