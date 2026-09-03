from __future__ import annotations

import argparse
import asyncio
import random
from dataclasses import dataclass
from math import cos, pi, sin

from camera_path.config import settings
from camera_path.models import (
    AnchorCreate,
    CameraKeyframeCreate,
    LookAtPointAim,
    Project,
    ProjectCreate,
    ScenePointCreate,
    SpeedKeyframeCreate,
    SpiralSegmentCreate,
    SplineSegmentCreate,
)
from camera_path.repository import SQLiteProjectRepository
from camera_path.service import TrajectoryService


@dataclass(frozen=True)
class PopulatedProject:
    project: Project
    created: bool


def _rounded(value: float) -> float:
    return round(value, 3)


async def _add_anchor(
    service: TrajectoryService,
    project: Project,
    label: str,
    position: tuple[float, float, float],
) -> tuple[Project, str]:
    previous_ids = set(project.anchors)
    project = await service.add_anchor(
        project.id,
        AnchorCreate(label=label, surface_position=position),
    )
    return project, (set(project.anchors) - previous_ids).pop()


async def _add_scene_point(
    service: TrajectoryService,
    project: Project,
    label: str,
    position: tuple[float, float, float],
) -> tuple[Project, str]:
    previous_ids = set(project.scene_points)
    project = await service.add_scene_point(
        project.id,
        ScenePointCreate(label=label, position=position),
    )
    return project, (set(project.scene_points) - previous_ids).pop()


async def _create_spline_project(
    service: TrajectoryService, rng: random.Random, name: str
) -> Project:
    project = await service.create_project(ProjectCreate(name=name))
    anchor_ids: list[str] = []
    for index in range(6):
        position = (
            _rounded(-4.0 + index * 1.6),
            _rounded(1.0 + rng.uniform(-0.35, 1.25)),
            _rounded(rng.uniform(-2.5, 2.5)),
        )
        project, anchor_id = await _add_anchor(service, project, f"Spline {index + 1}", position)
        anchor_ids.append(anchor_id)

    project = await service.add_spline(
        project.id,
        SplineSegmentCreate(anchor_ids=anchor_ids, tension=0.15),
    )
    project, target_id = await _add_scene_point(
        service,
        project,
        "Spline subject",
        (_rounded(rng.uniform(-1.0, 1.0)), 0.75, _rounded(rng.uniform(-0.75, 0.75))),
    )
    project = await service.add_speed_keyframe(
        project.id,
        SpeedKeyframeCreate(path_position=0.0, speed=1.2, interpolation_to_next="smoothstep"),
    )
    project = await service.add_speed_keyframe(
        project.id,
        SpeedKeyframeCreate(path_position=0.55, speed=0.45, interpolation_to_next="linear"),
    )
    return await service.add_camera_keyframe(
        project.id,
        CameraKeyframeCreate(
            path_position=0.45,
            aim=LookAtPointAim(scene_point_id=target_id),
            interpolation_to_next="smoothstep",
        ),
    )


async def _create_spiral_project(
    service: TrajectoryService, rng: random.Random, name: str
) -> Project:
    project = await service.create_project(ProjectCreate(name=name))
    center = (
        _rounded(rng.uniform(-0.5, 0.5)),
        _rounded(rng.uniform(0.4, 0.9)),
        _rounded(rng.uniform(-0.5, 0.5)),
    )
    start_angle = rng.uniform(-pi, pi)
    end_angle = start_angle + rng.uniform(pi / 3.0, 2.0 * pi / 3.0)
    start_radius = rng.uniform(2.0, 3.0)
    end_radius = rng.uniform(0.8, 1.5)
    start = (
        _rounded(center[0] + start_radius * cos(start_angle)),
        _rounded(center[1] + rng.uniform(-0.3, 0.3)),
        _rounded(center[2] - start_radius * sin(start_angle)),
    )
    end = (
        _rounded(center[0] + end_radius * cos(end_angle)),
        _rounded(center[1] + rng.uniform(2.0, 3.5)),
        _rounded(center[2] - end_radius * sin(end_angle)),
    )

    project, center_id = await _add_anchor(service, project, "Spiral center", center)
    project, start_id = await _add_anchor(service, project, "Spiral start", start)
    project, end_id = await _add_anchor(service, project, "Spiral end", end)
    project = await service.add_spiral(
        project.id,
        SpiralSegmentCreate(
            start_anchor_id=start_id,
            center_anchor_id=center_id,
            end_anchor_id=end_id,
            turns=1.75,
            direction="ccw",
            radial_law="smoothstep",
            axial_law="smoothstep",
        ),
    )
    project, target_id = await _add_scene_point(
        service,
        project,
        "Spiral subject",
        (center[0], _rounded(center[1] + 0.8), center[2]),
    )
    project = await service.add_speed_keyframe(
        project.id,
        SpeedKeyframeCreate(path_position=0.0, speed=0.8, interpolation_to_next="smoothstep"),
    )
    project = await service.add_speed_keyframe(
        project.id,
        SpeedKeyframeCreate(path_position=0.7, speed=0.3, interpolation_to_next="hold"),
    )
    return await service.add_camera_keyframe(
        project.id,
        CameraKeyframeCreate(
            path_position=0.0,
            aim=LookAtPointAim(scene_point_id=target_id),
            interpolation_to_next="smoothstep",
        ),
    )


async def populate_demo_projects(
    service: TrajectoryService, seed: int = 42
) -> list[PopulatedProject]:
    names = {
        "spline": f"[Demo {seed}] Random spline",
        "spiral": f"[Demo {seed}] Random spiral",
    }
    existing = {project.name: project for project in await service.list_projects()}
    results: list[PopulatedProject] = []

    spline = existing.get(names["spline"])
    if spline is None:
        spline = await _create_spline_project(
            service, random.Random(seed ^ 0x5A17), names["spline"]
        )
        results.append(PopulatedProject(project=spline, created=True))
    else:
        results.append(PopulatedProject(project=spline, created=False))

    spiral = existing.get(names["spiral"])
    if spiral is None:
        spiral = await _create_spiral_project(
            service, random.Random(seed ^ 0x5A18), names["spiral"]
        )
        results.append(PopulatedProject(project=spiral, created=True))
    else:
        results.append(PopulatedProject(project=spiral, created=False))
    return results


async def _populate(seed: int) -> None:
    repository = SQLiteProjectRepository(settings.database_path)
    service = TrajectoryService(repository, settings.compile_tolerance)
    for result in await populate_demo_projects(service, seed):
        status = "created" if result.created else "already exists"
        print(f"{result.project.name}: {status} ({result.project.id})")


def run() -> None:
    parser = argparse.ArgumentParser(description="Populate the Camera Path database with demos")
    parser.add_argument("--seed", type=int, default=42, help="random seed (default: 42)")
    arguments = parser.parse_args()
    asyncio.run(_populate(arguments.seed))


if __name__ == "__main__":
    run()
