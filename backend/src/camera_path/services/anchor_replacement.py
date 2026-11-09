"""Atomic anchor replacement, also used by durable generation completion intents."""

from sqlalchemy import select

from camera_path.persistence.records import ProjectRecord, SegmentAnchorRecord
from camera_path.repositories.anchor import AnchorRepository
from camera_path.repositories.scene_object import SceneObjectRepository
from camera_path.services.anchor_asset_fit import fit_asset_to_anchor
from camera_path.services.library_metadata import BoundingBox
from camera_path.services.revisions import advance_project_revision


async def replace_anchor(session, project_id, anchor_id, asset, expected=None, snapshot=None):
    anchors = await AnchorRepository(session).list(project_id)
    anchor = anchors.get(anchor_id)
    if anchor is None:
        raise ValueError("Anchor no longer exists")
    if snapshot is not None and anchor.model_dump(mode="json") != snapshot:
        raise ValueError("Anchor changed while generation was running")
    if await session.scalar(
        select(SegmentAnchorRecord.anchor_id)
        .where(SegmentAnchorRecord.anchor_id == anchor_id)
        .limit(1)
    ):
        raise ValueError("Anchor is referenced by a trajectory; remove that reference first")
    if asset.status != "ready" or asset.format not in {"ply", "sog"}:
        raise ValueError("Only ready 3DGS assets can replace anchors")
    transform = fit_asset_to_anchor(
        anchor,
        BoundingBox.model_validate(asset.bbox) if asset.bbox else None,
        tuple(getattr(asset, f"default_rotation_{a}_deg") for a in "xyz"),
    )
    if expected is None:
        expected = await session.scalar(
            select(ProjectRecord.revision).where(ProjectRecord.id == project_id)
        )
    await advance_project_revision(session, project_id, expected)
    file = next(f for f in asset.files if f.is_primary)
    record = await SceneObjectRepository(None).add(
        session,
        project_id,
        asset.id,
        file.id,
        asset.name,
        None,
        transform.model_dump(exclude_unset=True),
    )
    del anchors[anchor_id]
    await AnchorRepository(session).replace(project_id, anchors)
    return record


async def apply_job_placement(session, job, asset):
    intent = job.scene_placement
    if not intent or intent.get("status") != "pending":
        return
    try:
        # Savepoint keeps a failed placement from losing a valid generated library asset.
        async with session.begin_nested():
            record = await replace_anchor(
                session,
                intent["project_id"],
                intent["anchor"]["id"],
                asset,
                snapshot=intent["anchor"],
            )
        job.scene_placement = {**intent, "status": "succeeded", "scene_object_id": record.id}
    except (ValueError, KeyError) as error:
        job.scene_placement = {**intent, "status": "skipped", "reason": str(error)}
