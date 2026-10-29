"""Seed an isolated SQLite/PLY fixture for the CP-113 renderer experiment."""

import argparse
import asyncio
from datetime import datetime, timezone
from pathlib import Path

from camera_path.models import (
    Anchor,
    LookAtPointAim,
    Project,
    ScenePoint,
    SplineSegment,
)
from camera_path.persistence.models import (
    LibraryAssetRecord,
    ProjectCloudRecord,
    UserSettingsRecord,
)
from camera_path.repositories import ProjectRepository


async def seed(database: str, ply: Path) -> None:
    repo = ProjectRepository(database)
    project_id = "cp113-spark-experiment"
    try:
        await repo.initialize()
        if any(p.id == project_id for p in await repo.list()):
            print(project_id)
            return
        project = Project(id=project_id, name="CP-113 · upstream Spark WASM · mug.ply")
        anchors = [
            Anchor(label=f"Camera {i + 1}", surface_position=p)
            for i, p in enumerate([(-2, 1, 3), (2, 1, 3), (2, 1, -3), (-2, 1, -3)])
        ]
        project.anchors = {a.id: a for a in anchors}
        project.segments = [SplineSegment(anchor_ids=[a.id for a in anchors])]
        target = ScenePoint(label="Mug", position=(0, 0, 0))
        project.scene_points[target.id] = target
        project.camera_track.default_aim = LookAtPointAim(scene_point_id=target.id)
        await repo.create(project)
        async with repo.session_factory.begin() as session:
            session.add(
                LibraryAssetRecord(
                    id="cp113-mug",
                    name="mug.ply",
                    format="ply",
                    object_key="mug.ply",
                    size_bytes=ply.stat().st_size,
                    status="ready",
                    created_at=datetime.now(timezone.utc),
                )
            )
            await session.flush()
            session.add(
                ProjectCloudRecord(
                    id="cp113-mug-cloud",
                    project_id=project_id,
                    library_asset_id="cp113-mug",
                    position=0,
                    visible=True,
                    rotation_x_deg=180,
                )
            )
            session.add(
                UserSettingsRecord(
                    user_id="dev-user",
                    webgpu_tile_renderer=True,
                    gaussian_dpr="1x",
                    show_grid=True,
                )
            )
        print(project_id)
    finally:
        await repo.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--ply", required=True, type=Path)
    args = parser.parse_args()
    if not args.database.startswith("sqlite+aiosqlite:"):
        parser.error("This experiment only seeds an isolated local SQLite database")
    asyncio.run(seed(args.database, args.ply))
