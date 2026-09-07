import math

import numpy as np
import pytest

from camera_path.geometry import anchor_position, compile_project, compile_spiral
from camera_path.models import (
    Anchor,
    CameraKeyframe,
    CameraOrientation,
    CameraOrientationKeyframe,
    LookAtPointAim,
    Project,
    ScenePoint,
    SpeedKeyframe,
    SpiralSegment,
    SplineSegment,
)


def test_anchor_lift_uses_world_up() -> None:
    anchor = Anchor(label="A", surface_position=(1, 2, 3), lift=4)
    np.testing.assert_allclose(anchor_position(anchor), (1, 6, 3))


def test_spline_compiles_to_bezier_and_preserves_endpoints() -> None:
    a = Anchor(label="A", surface_position=(0, 0, 0))
    b = Anchor(label="B", surface_position=(1, 1, 0))
    c = Anchor(label="C", surface_position=(2, 0, 0))
    project = Project(anchors={item.id: item for item in (a, b, c)})
    project.segments.append(SplineSegment(anchor_ids=[a.id, b.id, c.id]))

    compiled = compile_project(project)

    assert len(compiled.position_segments) == 2
    assert compiled.position_segments[0].p0 == a.surface_position
    assert compiled.position_segments[-1].p3 == c.surface_position
    assert compiled.total_length > 2.0


def test_arc_length_table_contains_internal_monotonic_samples() -> None:
    anchors = [
        Anchor(label="A", surface_position=(0, 0, 0)),
        Anchor(label="B", surface_position=(1, 4, 0)),
        Anchor(label="C", surface_position=(2, 0, 0)),
    ]
    project = Project(anchors={item.id: item for item in anchors})
    project.segments.append(SplineSegment(anchor_ids=[item.id for item in anchors]))

    compiled = compile_project(project, tolerance=1e-5)

    assert any(0.0 < item.t < 1.0 for item in compiled.arc_length_table)
    distances = [item.distance for item in compiled.arc_length_table]
    assert distances == sorted(distances)
    assert distances[-1] == pytest.approx(compiled.total_length)


@pytest.mark.parametrize("direction", ["cw", "ccw"])
def test_spiral_hits_exact_start_and_end(direction: str) -> None:
    start = Anchor(label="D", surface_position=(2, 0, 0))
    center = Anchor(label="E", surface_position=(0, 0, 0))
    end = Anchor(label="F", surface_position=(0, 3, 1))
    project = Project(anchors={item.id: item for item in (start, center, end)})
    project.segments.append(
        SpiralSegment(
            start_anchor_id=start.id,
            center_anchor_id=center.id,
            end_anchor_id=end.id,
            turns=1.5,
            direction=direction,
        )
    )

    compiled = compile_project(project)

    np.testing.assert_allclose(compiled.position_segments[0].p0, start.surface_position)
    np.testing.assert_allclose(compiled.position_segments[-1].p3, end.surface_position, atol=1e-12)
    assert len(compiled.position_segments) >= 8


def test_short_spiral_preserves_requested_direction() -> None:
    center = Anchor(label="Center", surface_position=(0, 0, 0))
    start = Anchor(label="Start", surface_position=(1, 0, 0))
    end = Anchor(label="End", surface_position=(math.cos(0.2), 0, math.sin(0.2)))
    project = Project(anchors={item.id: item for item in (center, start, end)})
    project.segments.append(
        SpiralSegment(
            start_anchor_id=start.id,
            center_anchor_id=center.id,
            end_anchor_id=end.id,
            turns=0.1,
            direction="ccw",
        )
    )

    first_curve = compile_project(project).position_segments[0]
    initial_tangent = np.asarray(first_curve.p1) - np.asarray(first_curve.p0)

    # With Y as world-up, positive rotation from +X initially points toward -Z.
    assert initial_tangent[2] < 0.0


def test_speed_profile_changes_duration_and_is_sorted() -> None:
    a = Anchor(label="A", surface_position=(0, 0, 0))
    b = Anchor(label="B", surface_position=(10, 0, 0))
    project = Project(anchors={item.id: item for item in (a, b)})
    project.segments.append(SplineSegment(anchor_ids=[a.id, b.id]))
    fast = SpeedKeyframe(path_position=0.0, speed=2.0, interpolation_to_next="hold")
    slow = SpeedKeyframe(path_position=0.5, speed=1.0, interpolation_to_next="hold")
    project.motion_profile.keyframes = {slow.id: slow, fast.id: fast}

    compiled = compile_project(project)

    assert compiled.duration_seconds == pytest.approx(7.5)
    assert [item.id for item in compiled.motion_profile.keyframes] == [fast.id, slow.id]


def test_camera_track_resolves_scene_point_position() -> None:
    point = ScenePoint(label="Mug", position=(1, 2, 3))
    key = CameraKeyframe(
        path_position=0.6,
        aim=LookAtPointAim(scene_point_id=point.id),
    )
    project = Project(scene_points={point.id: point})
    project.camera_track.keyframes[key.id] = key

    compiled = compile_project(project)

    resolved = compiled.camera_track.keyframes[0].aim
    assert resolved.kind == "look_at_point"
    assert resolved.position == point.position


def test_camera_orientation_track_compiles_sorted_and_unwrapped() -> None:
    project = Project()
    last = CameraOrientationKeyframe(
        path_position=0.8,
        orientation=CameraOrientation(yaw_deg=360, pitch_deg=-20, roll_deg=15),
        interpolation_to_next="hold",
    )
    first = CameraOrientationKeyframe(
        path_position=0.2,
        orientation=CameraOrientation(yaw_deg=0, pitch_deg=5, roll_deg=-10),
        interpolation_to_next="linear",
    )
    project.camera_track.default_orientation = CameraOrientation(roll_deg=7)
    project.camera_track.orientation_keyframes = {last.id: last, first.id: first}

    compiled = compile_project(project)

    assert compiled.camera_track.default_orientation.roll_deg == 7
    assert [item.id for item in compiled.camera_track.orientation_keyframes] == [
        first.id,
        last.id,
    ]
    assert compiled.camera_track.orientation_keyframes[0].interpolation_to_next == "linear"
    assert compiled.camera_track.orientation_keyframes[1].orientation.yaw_deg == 360


def _spline_spiral_project(reverse: bool = False, scale: float = 1.0) -> Project:
    before = Anchor(label="Before", surface_position=(-2 * scale, 0, 0))
    junction = Anchor(label="Junction", surface_position=(2 * scale, 0, 0))
    center = Anchor(label="Center", surface_position=(0, 0, 0))
    after = Anchor(label="After", surface_position=(0, 2 * scale, scale))
    project = Project(anchors={item.id: item for item in (before, junction, center, after)})
    spline = SplineSegment(anchor_ids=[before.id, junction.id])
    spiral = SpiralSegment(
        start_anchor_id=junction.id,
        center_anchor_id=center.id,
        end_anchor_id=after.id,
        turns=1.25,
    )
    project.segments = (
        [spiral, SplineSegment(anchor_ids=[after.id, before.id])] if reverse else [spline, spiral]
    )
    return project


def _spiral_spiral_project() -> Project:
    start = Anchor(label="Start", surface_position=(2, 0, 0))
    first_center = Anchor(label="First center", surface_position=(0, 0, 0))
    junction = Anchor(label="Junction", surface_position=(0, 1, 2))
    second_center = Anchor(label="Second center", surface_position=(0, 1, 0))
    end = Anchor(label="End", surface_position=(-2, 2, 0))
    project = Project(
        anchors={item.id: item for item in (start, first_center, junction, second_center, end)}
    )
    project.segments = [
        SpiralSegment(
            start_anchor_id=start.id,
            center_anchor_id=first_center.id,
            end_anchor_id=junction.id,
            turns=1.25,
        ),
        SpiralSegment(
            start_anchor_id=junction.id,
            center_anchor_id=second_center.id,
            end_anchor_id=end.id,
            turns=1.25,
            direction="cw",
        ),
    ]
    return project


@pytest.mark.parametrize(
    "project",
    [_spline_spiral_project(), _spline_spiral_project(reverse=True), _spiral_spiral_project()],
    ids=["spline-to-spiral", "spiral-to-spline", "spiral-to-spiral"],
)
def test_semantic_segment_junctions_are_c1(project: Project) -> None:
    curves = compile_project(project, tolerance=1e-4).position_segments
    junctions = [
        (left, right)
        for left, right in zip(curves, curves[1:], strict=False)
        if left.source_segment_id != right.source_segment_id
    ]

    assert len(junctions) == 1
    left, right = junctions[0]
    np.testing.assert_allclose(left.p3, right.p0, atol=1e-12)
    incoming = np.asarray(left.p3) - np.asarray(left.p2)
    outgoing = np.asarray(right.p1) - np.asarray(right.p0)
    assert np.linalg.norm(incoming) > 0
    assert np.linalg.norm(outgoing) > 0
    np.testing.assert_allclose(incoming, outgoing, atol=1e-12)
    path_anchor_ids = {
        anchor_id
        for segment in project.segments
        for anchor_id in (
            segment.anchor_ids
            if isinstance(segment, SplineSegment)
            else [segment.start_anchor_id, segment.end_anchor_id]
        )
    }
    curve_endpoints = [point for curve in curves for point in (curve.p0, curve.p3)]
    for anchor_id in path_anchor_ids:
        expected = anchor_position(project.anchors[anchor_id])
        assert any(np.array_equal(expected, endpoint) for endpoint in curve_endpoints)


def _evaluate_bezier(curve, t: float) -> np.ndarray:
    p0, p1, p2, p3 = (np.asarray(point) for point in (curve.p0, curve.p1, curve.p2, curve.p3))
    u = 1.0 - t
    return u**3 * p0 + 3 * u**2 * t * p1 + 3 * u * t**2 * p2 + t**3 * p3


def test_spiral_smoothing_deviation_stays_within_tolerance() -> None:
    tolerance = 1e-2
    project = _spline_spiral_project()
    spiral = project.segments[1]
    assert isinstance(spiral, SpiralSegment)
    original = compile_spiral(project, spiral, tolerance)
    smoothed = [
        curve
        for curve in compile_project(project, tolerance).position_segments
        if curve.source_segment_id == spiral.id
    ]
    original_samples = np.vstack(
        [_evaluate_bezier(curve, t) for curve in original for t in np.linspace(0, 1, 401)]
    )

    max_deviation = max(
        float(np.min(np.linalg.norm(original_samples - _evaluate_bezier(curve, t), axis=1)))
        for curve in smoothed
        for t in np.linspace(0, 1, 41)
    )

    assert max_deviation <= tolerance * 1.05


def test_short_junction_has_forward_nonzero_handles_without_loop() -> None:
    curves = compile_project(_spline_spiral_project(scale=1e-3), tolerance=1e-7).position_segments
    left, right = next(
        (left, right)
        for left, right in zip(curves, curves[1:], strict=False)
        if left.source_segment_id != right.source_segment_id
    )
    incoming = np.asarray(left.p3) - np.asarray(left.p2)
    outgoing = np.asarray(right.p1) - np.asarray(right.p0)
    left_chord = np.asarray(left.p3) - np.asarray(left.p0)
    right_chord = np.asarray(right.p3) - np.asarray(right.p0)

    assert np.dot(incoming, left_chord) > 0
    assert np.dot(outgoing, right_chord) > 0
