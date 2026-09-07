from __future__ import annotations

from collections.abc import Callable
from math import ceil, cos, pi, sin

import numpy as np
from numpy.typing import NDArray

from camera_path.models import (
    Anchor,
    ArcLengthSample,
    CameraAim,
    CompiledCameraKeyframe,
    CompiledCameraTrack,
    CompiledMotionProfile,
    CompiledTrajectory,
    CubicBezier3D,
    FollowPathAim,
    LookAtPointAim,
    Project,
    ResolvedCameraAim,
    ResolvedLookAtPointAim,
    SpeedKeyframe,
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


def _split_bezier(
    points: tuple[Vector, Vector, Vector, Vector],
) -> tuple[tuple[Vector, Vector, Vector, Vector], tuple[Vector, Vector, Vector, Vector]]:
    return _split_bezier_at(points, 0.5)


def _split_bezier_at(
    points: tuple[Vector, Vector, Vector, Vector], t: float
) -> tuple[tuple[Vector, Vector, Vector, Vector], tuple[Vector, Vector, Vector, Vector]]:
    p0, p1, p2, p3 = points
    p01 = p0 + (p1 - p0) * t
    p12 = p1 + (p2 - p1) * t
    p23 = p2 + (p3 - p2) * t
    p012 = p01 + (p12 - p01) * t
    p123 = p12 + (p23 - p12) * t
    midpoint = p012 + (p123 - p012) * t
    return (p0, p01, p012, midpoint), (midpoint, p123, p23, p3)


def _bezier_arc_samples(
    points: tuple[Vector, Vector, Vector, Vector], tolerance: float
) -> list[tuple[float, float]]:
    """Return adaptive ``(t, cumulative_length)`` samples for one cubic Bézier."""
    samples: list[tuple[float, float]] = [(0.0, 0.0)]
    distance = 0.0

    def visit(
        control_points: tuple[Vector, Vector, Vector, Vector],
        t0: float,
        t1: float,
        depth: int,
    ) -> None:
        nonlocal distance
        chord = float(np.linalg.norm(control_points[3] - control_points[0]))
        polygon = sum(
            float(np.linalg.norm(control_points[index + 1] - control_points[index]))
            for index in range(3)
        )
        if polygon - chord <= 2.0 * tolerance or depth >= 20:
            distance += (polygon + chord) * 0.5
            samples.append((t1, distance))
            return
        left, right = _split_bezier(control_points)
        midpoint = (t0 + t1) * 0.5
        visit(left, t0, midpoint, depth + 1)
        visit(right, midpoint, t1, depth + 1)

    visit(points, 0.0, 1.0, 0)
    return samples


def _make_bezier(
    source_id: str,
    points: tuple[Vector, Vector, Vector, Vector],
    tolerance: float,
) -> CubicBezier3D:
    length = _bezier_arc_samples(points, tolerance)[-1][1]
    return CubicBezier3D(
        source_segment_id=source_id,
        p0=_tuple(points[0]),
        p1=_tuple(points[1]),
        p2=_tuple(points[2]),
        p3=_tuple(points[3]),
        length=length,
    )


def _centripetal_tangent(previous: Vector, point: Vector, following: Vector) -> Vector:
    before = max(float(np.linalg.norm(point - previous)) ** 0.5, 1e-9)
    after = max(float(np.linalg.norm(following - point)) ** 0.5, 1e-9)
    return (following - previous) / (before + after)


def compile_spline(
    project: Project, segment: SplineSegment, tolerance: float = 1e-3
) -> list[CubicBezier3D]:
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
        result.append(_make_bezier(segment.id, bezier, tolerance))
    return result


def _law(name: str, t: float) -> tuple[float, float]:
    if name == "linear":
        return t, 1.0
    return t * t * (3.0 - 2.0 * t), 6.0 * t * (1.0 - t)


def compile_spiral(
    project: Project, segment: SpiralSegment, tolerance: float = 1e-3
) -> list[CubicBezier3D]:
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
    direction = 1.0 if segment.direction == "ccw" else -1.0
    nominal_angle = direction * (2.0 * pi * segment.turns)
    if end_radius < 1e-8:
        # The phase is undefined on the axis, so preserve the requested turn count exactly.
        total_angle = nominal_angle
    else:
        end_angle = float(np.arctan2(np.dot(end_flat, e2), np.dot(end_flat, e1)))
        # Choose the matching end phase nearest to the requested turn count, but never reverse.
        revolutions = round((nominal_angle - end_angle) / (2.0 * pi))
        total_angle = end_angle + 2.0 * pi * revolutions
        if direction * total_angle <= 0.0:
            total_angle += direction * 2.0 * pi
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
        if index == 0:
            p0 = start
        if index == pieces - 1:
            p3 = end
        dt = t1 - t0
        result.append(
            _make_bezier(
                segment.id,
                (p0, p0 + d0 * dt / 3, p3 - d1 * dt / 3, p3),
                tolerance,
            )
        )
    return result


def _curve_points(curve: CubicBezier3D) -> tuple[Vector, Vector, Vector, Vector]:
    return tuple(_v(point) for point in (curve.p0, curve.p1, curve.p2, curve.p3))  # type: ignore[return-value]


def _unit(vector: Vector, fallback: Vector) -> Vector:
    length = float(np.linalg.norm(vector))
    if length < 1e-12:
        vector = fallback
        length = float(np.linalg.norm(vector))
    if length < 1e-12:
        raise GeometryError("cannot smooth a junction between zero-length curve pieces")
    return vector / length


def _junction_direction(
    left: tuple[Vector, Vector, Vector, Vector],
    right: tuple[Vector, Vector, Vector, Vector],
) -> Vector:
    point = left[3]
    incoming = _unit(point - left[2], point - left[0])
    outgoing = _unit(right[1] - point, right[3] - point)
    combined = incoming + outgoing
    if float(np.linalg.norm(combined)) < 1e-8:
        combined = right[3] - left[0]
    if float(np.linalg.norm(combined)) < 1e-8:
        combined = incoming
    direction = _unit(combined, incoming)
    if np.dot(direction, incoming + outgoing) < 0.0:
        direction = -direction
    return direction


def _smooth_junction(
    left_curve: CubicBezier3D,
    right_curve: CubicBezier3D,
    tolerance: float,
) -> tuple[list[CubicBezier3D], list[CubicBezier3D]]:
    left = _curve_points(left_curve)
    right = _curve_points(right_curve)
    if not np.allclose(left[3], right[0], rtol=0.0, atol=1e-10):
        return [left_curve], [right_curve]

    direction = _junction_direction(left, right)
    blend_fraction = 0.25
    while True:
        left_prefix, left_tail = _split_bezier_at(left, 1.0 - blend_fraction)
        right_head, right_suffix = _split_bezier_at(right, blend_fraction)
        point = left_tail[3]
        incoming_length = float(np.linalg.norm(point - left_tail[2]))
        outgoing_length = float(np.linalg.norm(right_head[1] - point))
        local_scale = min(
            float(np.linalg.norm(point - left_tail[0])),
            float(np.linalg.norm(right_head[3] - point)),
        )
        if local_scale < 1e-12:
            raise GeometryError("cannot smooth a junction next to a zero-length curve piece")
        handle_length = min(
            max((incoming_length + outgoing_length) * 0.5, local_scale * 1e-6),
            local_scale / 3.0,
        )
        smoothed_left_tail = (*left_tail[:2], point - direction * handle_length, point)
        smoothed_right_head = (
            point,
            point + direction * handle_length,
            *right_head[2:],
        )

        # Only one control point changes on either side. Its Bernstein weight never
        # exceeds 4/9, so this is a conservative bound on geometric deformation.
        deviation_bound = (4.0 / 9.0) * max(
            float(np.linalg.norm(smoothed_left_tail[2] - left_tail[2])),
            float(np.linalg.norm(smoothed_right_head[1] - right_head[1])),
        )
        if deviation_bound <= tolerance or blend_fraction <= 2.0**-20:
            return (
                [
                    _make_bezier(left_curve.source_segment_id, left_prefix, tolerance),
                    _make_bezier(left_curve.source_segment_id, smoothed_left_tail, tolerance),
                ],
                [
                    _make_bezier(right_curve.source_segment_id, smoothed_right_head, tolerance),
                    _make_bezier(right_curve.source_segment_id, right_suffix, tolerance),
                ],
            )
        blend_fraction *= 0.5


def _smooth_curve_groups(
    groups: list[list[CubicBezier3D]], tolerance: float
) -> list[CubicBezier3D]:
    for index in range(len(groups) - 1):
        left_group, right_group = groups[index], groups[index + 1]
        left_replacement, right_replacement = _smooth_junction(
            left_group[-1], right_group[0], tolerance
        )
        left_group[-1:] = left_replacement
        right_group[:1] = right_replacement
    return [curve for group in groups for curve in group]


def _validate_smoothed_junctions(curves: list[CubicBezier3D]) -> None:
    for left, right in zip(curves, curves[1:], strict=False):
        if left.source_segment_id == right.source_segment_id:
            continue
        left_points, right_points = _curve_points(left), _curve_points(right)
        if not np.allclose(left_points[3], right_points[0], rtol=0.0, atol=1e-10):
            continue
        incoming = left_points[3] - left_points[2]
        outgoing = right_points[1] - right_points[0]
        incoming_length = float(np.linalg.norm(incoming))
        outgoing_length = float(np.linalg.norm(outgoing))
        if incoming_length < 1e-12 or outgoing_length < 1e-12:
            raise GeometryError("smoothed junction has a zero-length handle")
        cosine = float(np.dot(incoming, outgoing) / (incoming_length * outgoing_length))
        if cosine < 1.0 - 1e-10:
            raise GeometryError("compiled trajectory has a tangent discontinuity")


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

    speed_positions = [item.path_position for item in project.motion_profile.keyframes.values()]
    if len(speed_positions) != len(set(speed_positions)):
        raise GeometryError("speed keyframes must have unique path positions")
    camera_positions = [item.path_position for item in project.camera_track.keyframes.values()]
    if len(camera_positions) != len(set(camera_positions)):
        raise GeometryError("camera keyframes must have unique path positions")
    orientation_positions = [
        item.path_position for item in project.camera_track.orientation_keyframes.values()
    ]
    if len(orientation_positions) != len(set(orientation_positions)):
        raise GeometryError("camera orientation keyframes must have unique path positions")

    aims = [project.camera_track.default_aim]
    aims.extend(item.aim for item in project.camera_track.keyframes.values())
    missing_scene_points = {
        aim.scene_point_id
        for aim in aims
        if isinstance(aim, LookAtPointAim) and aim.scene_point_id not in project.scene_points
    }
    if missing_scene_points:
        raise GeometryError(
            f"camera track references missing scene points: {sorted(missing_scene_points)}"
        )
    if np.linalg.norm(_v(project.camera_track.world_up)) < 1e-8:
        raise GeometryError("camera world_up must be non-zero")
    return warnings


def _speed_duration(project: Project, total_length: float) -> float:
    if total_length == 0.0:
        return 0.0
    keys = sorted(project.motion_profile.keyframes.values(), key=lambda item: item.path_position)
    controls: list[tuple[float, float, str]] = [
        (item.path_position, item.speed, item.interpolation_to_next) for item in keys
    ]
    if not controls or controls[0][0] > 0.0:
        controls.insert(0, (0.0, project.motion_profile.default_speed, "smoothstep"))
    if controls[-1][0] < 1.0:
        controls.append((1.0, project.motion_profile.default_speed, "smoothstep"))

    nodes, weights = np.polynomial.legendre.leggauss(16)
    normalized_time = 0.0
    for left, right in zip(controls, controls[1:], strict=False):
        start, start_speed, interpolation = left
        end, end_speed, _ = right
        width = end - start
        if width <= 0.0:
            continue
        u = (nodes + 1.0) * 0.5
        if interpolation == "hold":
            blend = np.zeros_like(u)
        elif interpolation == "linear":
            blend = u
        else:
            blend = u * u * (3.0 - 2.0 * u)
        speeds = start_speed + (end_speed - start_speed) * blend
        normalized_time += width * 0.5 * float(np.dot(weights, 1.0 / speeds))
    return total_length * normalized_time


def _resolve_aim(project: Project, aim: CameraAim) -> ResolvedCameraAim:
    if isinstance(aim, FollowPathAim):
        return aim
    point = project.scene_points[aim.scene_point_id]
    return ResolvedLookAtPointAim(scene_point_id=point.id, position=point.position)


def compile_project(project: Project, tolerance: float = 1e-3) -> CompiledTrajectory:
    if tolerance <= 0.0:
        raise ValueError("tolerance must be positive")
    warnings = validate_project(project)
    compilers: dict[type, Callable[[Project, object, float], list[CubicBezier3D]]] = {
        SplineSegment: compile_spline,
        SpiralSegment: compile_spiral,
    }
    groups = [compilers[type(segment)](project, segment, tolerance) for segment in project.segments]
    curves = _smooth_curve_groups(groups, tolerance)
    _validate_smoothed_junctions(curves)

    table: list[ArcLengthSample] = []
    distance = 0.0
    for index, curve in enumerate(curves):
        points = tuple(_v(point) for point in (curve.p0, curve.p1, curve.p2, curve.p3))
        local_samples = _bezier_arc_samples(points, tolerance)  # type: ignore[arg-type]
        for t, local_distance in local_samples:
            if table and t == 0.0:
                continue
            table.append(
                ArcLengthSample(
                    segment_index=index,
                    t=t,
                    distance=distance + local_distance,
                )
            )
        distance += curve.length
    speed_keys: list[SpeedKeyframe] = sorted(
        project.motion_profile.keyframes.values(), key=lambda item: item.path_position
    )
    camera_keys = [
        CompiledCameraKeyframe(
            id=item.id,
            path_position=item.path_position,
            aim=_resolve_aim(project, item.aim),
            interpolation_to_next=item.interpolation_to_next,
        )
        for item in sorted(
            project.camera_track.keyframes.values(), key=lambda item: item.path_position
        )
    ]
    return CompiledTrajectory(
        project_id=project.id,
        revision=project.revision,
        position_segments=curves,
        arc_length_table=table,
        total_length=distance,
        duration_seconds=_speed_duration(project, distance),
        motion_profile=CompiledMotionProfile(
            default_speed=project.motion_profile.default_speed,
            keyframes=speed_keys,
        ),
        camera_track=CompiledCameraTrack(
            default_aim=_resolve_aim(project, project.camera_track.default_aim),
            keyframes=camera_keys,
            default_orientation=project.camera_track.default_orientation,
            orientation_keyframes=sorted(
                project.camera_track.orientation_keyframes.values(),
                key=lambda item: item.path_position,
            ),
            world_up=project.camera_track.world_up,
        ),
        warnings=warnings,
    )
