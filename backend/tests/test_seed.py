from camera_path.models import SpiralSegment, SplineSegment
from camera_path.repository import SQLiteProjectRepository
from camera_path.seed import populate_demo_projects
from camera_path.service import TrajectoryService


async def test_populate_creates_spline_and_spiral_projects(tmp_path) -> None:
    service = TrajectoryService(SQLiteProjectRepository(tmp_path / "seed.sqlite3"))

    results = await populate_demo_projects(service, seed=7)

    assert len(results) == 2
    assert all(result.created for result in results)
    spline, spiral = [result.project for result in results]
    assert len(spline.anchors) == 6
    assert len(spline.scene_points) == 1
    assert isinstance(spline.segments[0], SplineSegment)
    assert len(spiral.anchors) == 3
    assert len(spiral.scene_points) == 1
    assert isinstance(spiral.segments[0], SpiralSegment)
    assert service.compile_draft(spline).position_segments
    assert service.compile_draft(spiral).position_segments


async def test_populate_is_idempotent_for_the_same_seed(tmp_path) -> None:
    service = TrajectoryService(SQLiteProjectRepository(tmp_path / "seed.sqlite3"))

    first = await populate_demo_projects(service, seed=11)
    second = await populate_demo_projects(service, seed=11)

    assert all(result.created for result in first)
    assert not any(result.created for result in second)
    assert [result.project.id for result in first] == [result.project.id for result in second]
    assert len(await service.list_projects()) == 2
