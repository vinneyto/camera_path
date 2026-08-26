import numpy as np
import pytest

from camera_path.geometry import anchor_position, compile_project
from camera_path.models import Anchor, Project, SpiralSegment, SplineSegment


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
