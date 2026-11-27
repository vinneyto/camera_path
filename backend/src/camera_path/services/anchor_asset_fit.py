"""Fit a library bounding box between an anchor's base and lifted marker."""

import itertools
import math

from camera_path.models import Anchor
from camera_path.services.library_metadata import BoundingBox
from camera_path.services.scene_objects import SceneObjectUpdate
from camera_path.services.scene_transforms import (
    normalize_quaternion,
    quaternion_from_euler_xyz,
    transformed_offset,
)


def fit_asset_to_anchor(anchor: Anchor, bbox: BoundingBox | None, rotation_deg):
    if bbox is None:
        raise ValueError("Library asset has no bounding box")
    if anchor.lift <= 0:
        raise ValueError("Anchor height must be positive")
    base_rotation = quaternion_from_euler_xyz(rotation_deg)
    corners = [
        transformed_offset(base_rotation, (1, 1, 1), p)
        for p in itertools.product(*zip(bbox.min, bbox.max, strict=True))
    ]
    lower = tuple(min(p[i] for p in corners) for i in range(3))
    upper = tuple(max(p[i] for p in corners) for i in range(3))
    height = upper[1] - lower[1]
    if height <= 1e-9:
        raise ValueError("Library asset bounding box has zero height")
    scale = (anchor.lift / height,) * 3
    axis = anchor.surface_normal if anchor.lift_axis == "surface_normal" else (0, 1, 0)
    length = math.hypot(*axis)
    if length <= 1e-9:
        raise ValueError("Anchor normal must be nonzero")
    x, y, z = (v / length for v in axis)
    align = (1, 0, 0, 0) if y < -1 + 1e-9 else normalize_quaternion((z, 0, -x, 1 + y))
    ax, ay, az, aw = align
    bx, by, bz, bw = base_rotation
    quaternion = normalize_quaternion(
        (
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        )
    )
    bottom = ((lower[0] + upper[0]) / 2, lower[1], (lower[2] + upper[2]) / 2)
    offset = transformed_offset(align, scale, bottom)
    return SceneObjectUpdate(
        position=tuple(anchor.surface_position[i] - offset[i] for i in range(3)),
        quaternion=quaternion,
        scale=scale,
    )
