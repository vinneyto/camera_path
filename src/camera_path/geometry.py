from __future__ import annotations

from collections.abc import Callable
from math import ceil, cos, pi, sin

import numpy as np
from numpy.typing import NDArray

from camera_path.models import (
    Anchor,
    ArcLengthSample,
    CompiledTrajectory,
    CubicBezier3D,
    Project,
    SpiralSegment,
    SplineSegment,
    Vec3,
)

Vector = NDArray[np.float64]


class GeometryError(ValueError):
    pass


def _v(value: Vec3) -> Vector:
    return np.asarray(value, dtype=np.float64)


def _tuple(value: Vector) -> Vec3:
    return tuple(float(item) for item in value)  # type: ignore[return-value]


def anchor_position(anchor: Anchor) -> Vector:
    axis = np.array((0.0, 1.0, 0.0))
    if anchor.lift_axis == "surface_normal":
        axis = _v(anchor.surface_normal)
        axis /= np.linalg.norm(axis)
    return _v(anchor.surface_position) + anchor.lift * axis


def _bezier_length(points: tuple[Vector, Vector, Vector, Vector], samples: int = 24) -> float:
    ts = np.linspace(0.0, 1.0, samples + 1)
    p0, p1, p2, p3 = points
    curve = (
        ((1 - ts) ** 3)[:, None] * p0
        + (3 * (1 - ts) ** 2 * ts)[:, None] * p1
        + (3 * (1 - ts) * ts**2)[:, None] * p2
        + (ts**3)[:, None] * p3
    )
    return float(np.linalg.norm(np.diff(curve, axis=0), axis=1).sum())


def _make_bezier(source_id: str, points: tuple[Vector, Vector, Vector, Vector]) -> CubicBezier3D:
    return CubicBezier3D(
        source_segment_id=source_id,
        p0=_tuple(points[0]),
        p1=_tuple(points[1]),
        p2=_tuple(points[2]),
        p3=_tuple(points[3]),
        length=_bezier_length(points),
    )


def _centripetal_tangent(previous: Vector, point: Vector, following: Vector) -> Vector:
    before = max(float(np.linalg.norm(point - previous)) ** 0.5, 1e-9)
    after = max(float(np.linalg.norm(following - point)) ** 0.5, 1e-9)
    return (following - previous) / (before + after)


def compile_spline(project: Project, segment: SplineSegment) -> list[CubicBezier3D]:
    points = [anchor_position(project.anchors[item]) for item in segment.anchor_ids]
    scale = 1.0 - segment.tension
    result: list[CubicBezier3D] = []
    for index in range(len(points) - 1):
        p0, p3 = points[index], points[index + 1]
        previous = points[index - 1] if index else p0
        following = points[index + 2] if index + 2 < len(points) else p3
        m0 = _centripetal_tangent(previous, p0, p3) * scale
        m1 = _centripetal_tangent(p0, p3, following) * scale
        chord_scale = max(float(np.linalg.norm(p3 - p0)) ** 0.5, 1e-9)
        bezier = (p0, p0 + m0 * chord_scale / 3.0, p3 - m1 * chord_scale / 3.0, p3)
        result.append(_make_bezier(segment.id, bezier))
    return result


def _law(name: str, t: float) -> tuple[float, float]:
    if name == "linear":
        return t, 1.0
    return t * t * (3.0 - 2.0 * t), 6.0 * t * (1.0 - t)


def compile_spiral(project: Project, segment: SpiralSegment) -> list[CubicBezier3D]:
    start = anchor_position(project.anchors[segment.start_anchor_id])
    center = anchor_position(project.anchors[segment.center_anchor_id])
    end = anchor_position(project.anchors[segment.end_anchor_id])
    up = np.array((0.0, 1.0, 0.0))

    start_flat = start - center - np.dot(start - center, up) * up
    end_flat = end - center - np.dot(end - center, up) * up
    start_radius = float(np.linalg.norm(start_flat))
    end_radius = float(np.linalg.norm(end_flat))
    if start_radius < 1e-8:
        raise GeometryError("spiral start must not lie on its axis")

    e1 = start_flat / start_radius
    e2 = np.cross(up, e1)
    end_angle = (
        0.0 if end_radius < 1e-8 else float(np.arctan2(np.dot(end_flat, e2), np.dot(end_flat, e1)))
    )
    direction = 1.0 if segment.direction == "ccw" else -1.0
    nominal_angle = direction * (2.0 * pi * segment.turns)
    # Choose the representation of the end phase nearest to the requested turn count.
    revolutions = round((nominal_angle - end_angle) / (2.0 * pi))
    total_angle = end_angle + 2.0 * pi * revolutions
    start_height = float(np.dot(start - center, up))
    end_height = float(np.dot(end - center, up))

    def evaluate(t: float) -> tuple[Vector, Vector]:
        radial_s, radial_ds = _law(segment.radial_law, t)
        axial_s, axial_ds = _law(segment.axial_law, t)
        radius = start_radius + (end_radius - start_radius) * radial_s
        radius_d = (end_radius - start_radius) * radial_ds
        height = start_height + (end_height - start_height) * axial_s
        height_d = (end_height - start_height) * axial_ds
        angle = total_angle * t
        radial = cos(angle) * e1 + sin(angle) * e2
        tangent = -sin(angle) * e1 + cos(angle) * e2
        position = center + height * up + radius * radial
        derivative = height_d * up + radius_d * radial + radius * total_angle * tangent
        return position, derivative

    pieces = max(1, ceil(abs(total_angle) / (pi / 4.0)))
    result: list[CubicBezier3D] = []
    for index in range(pieces):
        t0, t1 = index / pieces, (index + 1) / pieces
        p0, d0 = evaluate(t0)
        p3, d1 = evaluate(t1)
        dt = t1 - t0
        result.append(_make_bezier(segment.id, (p0, p0 + d0 * dt / 3, p3 - d1 * dt / 3, p3)))
    return result


def validate_project(project: Project) -> list[str]:
    warnings: list[str] = []
    for segment in project.segments:
        ids = (
            segment.anchor_ids
            if isinstance(segment, SplineSegment)
            else [segment.start_anchor_id, segment.center_anchor_id, segment.end_anchor_id]
        )
        missing = [item for item in ids if item not in project.anchors]
        if missing:
            raise GeometryError(f"segment {segment.id} references missing anchors: {missing}")
    for first, second in zip(project.segments, project.segments[1:], strict=False):
        first_end = (
            first.anchor_ids[-1] if isinstance(first, SplineSegment) else first.end_anchor_id
        )
        second_start = (
            second.anchor_ids[0] if isinstance(second, SplineSegment) else second.start_anchor_id
        )
        if first_end != second_start:
            warnings.append(f"segments {first.id} and {second.id} are not C0-connected")
    return warnings


def compile_project(project: Project) -> CompiledTrajectory:
    warnings = validate_project(project)
    curves: list[CubicBezier3D] = []
    compilers: dict[type, Callable[[Project, object], list[CubicBezier3D]]] = {
        SplineSegment: compile_spline,
        SpiralSegment: compile_spiral,
    }
    for segment in project.segments:
        curves.extend(compilers[type(segment)](project, segment))

    table = [ArcLengthSample(segment_index=0, t=0.0, distance=0.0)] if curves else []
    distance = 0.0
    for index, curve in enumerate(curves):
        distance += curve.length
        table.append(ArcLengthSample(segment_index=index, t=1.0, distance=distance))
    return CompiledTrajectory(
        project_id=project.id,
        revision=project.revision,
        position_segments=curves,
        arc_length_table=table,
        total_length=distance,
        duration_seconds=distance / project.motion_profile.speed,
        warnings=warnings,
    )
