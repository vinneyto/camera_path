import math

import numpy as np
import pytest

from camera_path.geometry import anchor_position, compile_project
from camera_path.models import (
    Anchor,
    CameraKeyframe,
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
