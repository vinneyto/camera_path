from enum import StrEnum


class SegmentKind(StrEnum):
    SPLINE = "spline"
    SPIRAL = "spiral"


class SpiralDirection(StrEnum):
    CW = "cw"
    CCW = "ccw"


class CurveLaw(StrEnum):
    LINEAR = "linear"
    SMOOTHSTEP = "smoothstep"


class AimKind(StrEnum):
    FOLLOW_PATH = "follow_path"
    LOOK_AT_POINT = "look_at_point"


class AimDirection(StrEnum):
    FORWARD = "forward"
    BACKWARD = "backward"


class Interpolation(StrEnum):
    HOLD = "hold"
    LINEAR = "linear"
    SMOOTHSTEP = "smoothstep"


class FocusKind(StrEnum):
    CENTER_WEIGHTED_9 = "center_weighted_9"
    SCENE_POINT = "scene_point"


class LiftAxis(StrEnum):
    WORLD_UP = "world_up"
    SURFACE_NORMAL = "surface_normal"


class LibraryAssetStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
