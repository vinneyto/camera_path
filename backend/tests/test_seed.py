from camera_path.models import SpiralSegment, SplineSegment
from camera_path.repository import SQLiteProjectRepository
from camera_path.seed import populate_demo_projects
from camera_path.service import TrajectoryService


async def test_populate_creates_spline_spiral_and_mixed_projects(tmp_path) -> None:
    service = TrajectoryService(SQLiteProjectRepository(tmp_path / "seed.sqlite3"))

    results = await populate_demo_projects(service, seed=7)

    assert len(results) == 4
    assert all(result.created for result in results)
    spline, spiral, mixed, inertial = [result.project for result in results]
    assert len(spline.anchors) == 6
    assert len(spline.scene_points) == 1
    assert isinstance(spline.segments[0], SplineSegment)
    assert len(spiral.anchors) == 3
    assert len(spiral.scene_points) == 1
    assert isinstance(spiral.segments[0], SpiralSegment)
    assert [type(segment) for segment in mixed.segments] == [
        SplineSegment,
        SpiralSegment,
        SplineSegment,
    ]
    assert service.compile_draft(spline).position_segments
    assert service.compile_draft(spiral).position_segments
    mixed_curves = service.compile_draft(mixed).position_segments
    junctions = [
        (left, right)
        for left, right in zip(mixed_curves, mixed_curves[1:], strict=False)
        if left.source_segment_id != right.source_segment_id
    ]
    assert len(junctions) == 2
    for left, right in junctions:
        assert left.p3 == right.p0
        incoming = tuple(end - control for end, control in zip(left.p3, left.p2, strict=True))
        outgoing = tuple(control - start for control, start in zip(right.p1, right.p0, strict=True))
        incoming_length = sum(component * component for component in incoming) ** 0.5
        outgoing_length = sum(component * component for component in outgoing) ** 0.5
        cosine = sum(a * b for a, b in zip(incoming, outgoing, strict=True)) / (
            incoming_length * outgoing_length
        )
        assert cosine > 1.0 - 1e-10
    assert len(inertial.anchors) == 5
    assert isinstance(inertial.segments[0], SplineSegment)
    assert service.compile_draft(inertial).position_segments


async def test_populate_is_idempotent_for_the_same_seed(tmp_path) -> None:
    service = TrajectoryService(SQLiteProjectRepository(tmp_path / "seed.sqlite3"))

    first = await populate_demo_projects(service, seed=11)
    second = await populate_demo_projects(service, seed=11)

    assert all(result.created for result in first)
    assert not any(result.created for result in second)
    assert [result.project.id for result in first] == [result.project.id for result in second]
    assert len(await service.list_projects()) == 4
