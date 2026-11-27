"""Deterministic scene/library operations available to the conversational agent."""

import hashlib
import json

from sqlalchemy import select, text

from camera_path.persistence.records import JobRecord, LibraryAssetRecord
from camera_path.services.anchor_asset_fit import fit_asset_to_anchor
from camera_path.services.anchor_replacement import replace_anchor
from camera_path.services.anchors import AnchorService
from camera_path.services.jobs import JobCreate
from camera_path.services.library_metadata import BoundingBox
from camera_path.services.scene_objects import SceneObjectCreate, SceneObjectUpdate
from camera_path.services.scene_primitives import ScenePrimitive


def tool(name, description, properties):
    return {
        "type": "function",
        "name": name,
        "description": description,
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": list(properties),
            "additionalProperties": False,
        },
    }


ID = {"type": "string"}
OPTIONAL_ID = {"type": ["string", "null"]}
VECTOR = {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3}
QUATERNION = {**VECTOR, "minItems": 4, "maxItems": 4}
SCENE_TOOLS = [
    tool(
        "list_library_assets", "List ready library assets, names, bbox and placement defaults.", {}
    ),
    tool(
        "create_library_asset",
        (
            "Publish an attached original image in the library, idempotently. Use an "
            "attachment ID from the conversation."
        ),
        {"attachment_id": ID},
    ),
    tool(
        "start_image_generation",
        (
            "Start image-to-3D generation. Optionally replace the specified anchor after "
            "success, without another agent call. Never promise immediate completion."
        ),
        {"image_asset_id": ID, "replace_anchor_id": OPTIONAL_ID, "name": OPTIONAL_ID},
    ),
    tool(
        "get_generation_job",
        "Read job status, generated assets and deferred scene placement outcome.",
        {"job_id": ID},
    ),
    tool(
        "fit_library_asset_to_anchor",
        (
            "Calculate world position, XYZW quaternion and uniform scale to fit a 3DGS "
            "bbox between an anchor base and upper pin, including library rotation "
            "defaults."
        ),
        {"anchor_id": ID, "library_asset_id": ID},
    ),
    tool(
        "replace_anchor_with_asset",
        (
            "Atomically fit/place a ready library 3DGS asset and remove an unused anchor. "
            "Anchors used by trajectory segments cannot be removed."
        ),
        {"anchor_id": ID, "library_asset_id": ID},
    ),
    tool(
        "create_scene_object",
        (
            "Place a library model with explicit local TRS. Quaternion order is XYZW. Use "
            "fit_library_asset_to_anchor for fitted transforms."
        ),
        {"library_asset_id": ID, "position": VECTOR, "quaternion": QUATERNION, "scale": VECTOR},
    ),
    tool(
        "create_scene_primitive",
        (
            "Place a client-rendered cube, sphere or cone. All have unit size, centered at "
            "the local origin: cube sides 1, sphere diameter 1, cone diameter/height 1 (tip +Y). "
            "Use local TRS for dimensions and placement; quaternion order is XYZW. "
            "Color is an optional #RRGGBB string. Null parent_id places it at the scene root."
        ),
        {
            "type": {"type": "string", "enum": ["cube", "sphere", "cone"]},
            "color": {"type": ["string", "null"], "pattern": "^#[0-9a-fA-F]{6}$"},
            "parent_id": OPTIONAL_ID,
            "position": VECTOR,
            "quaternion": QUATERNION,
            "scale": VECTOR,
        },
    ),
    tool(
        "update_scene_object",
        (
            "Move, rotate or scale an existing scene instance by its instance ID. Null "
            "preserves a field; quaternion order is XYZW."
        ),
        {
            "id": ID,
            "position": {**VECTOR, "type": ["array", "null"]},
            "quaternion": {**QUATERNION, "type": ["array", "null"]},
            "scale": {**VECTOR, "type": ["array", "null"]},
        },
    ),
    tool(
        "delete_scene_object",
        (
            "Remove one scene instance, preserving its library asset. Children must be "
            "moved or removed first."
        ),
        {"id": ID},
    ),
    tool(
        "delete_anchor", "Remove one anchor unless a trajectory segment references it.", {"id": ID}
    ),
]
READ_ONLY = {"list_library_assets", "get_generation_job", "fit_library_asset_to_anchor"}


def describe_asset(asset):
    return {
        "id": asset.id,
        "name": asset.name,
        "format": asset.format,
        "bbox": asset.bbox,
        "default_rotation_deg": [getattr(asset, f"default_rotation_{a}_deg") for a in "xyz"],
        "default_scale": asset.default_scale,
    }


class SceneAgentTools:
    def __init__(self, repository, library, jobs, scene_objects, attachments):
        self.repository, self.library, self.jobs = repository, library, jobs
        self.scene_objects, self.attachments = scene_objects, attachments
        self.sessions = repository.session_factory

    async def state(self, project_id):
        records, _ = await self.scene_objects.repository.list(project_id)
        return [
            {
                "id": r.id,
                "name": r.name,
                "library_asset_id": r.library_asset_id,
                "primitive": json.loads(r.primitive) if r.primitive is not None else None,
                "parent_id": r.parent_id,
                "visible": r.visible,
                **{
                    field: [getattr(r, f"{field}_{a}") for a in axes]
                    for field, axes in (
                        ("position", "xyz"),
                        ("quaternion", "xyzw"),
                        ("scale", "xyz"),
                    )
                },
            }
            for r in records
        ]

    async def job(self, job_id):
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            if job is None:
                raise ValueError("Job not found")
            return {
                "id": job.id,
                "name": job.name,
                "status": job.status.value,
                "error": job.error,
                "scene_placement": job.scene_placement,
                "assets": [describe_asset(a) for a in job.assets],
            }

    async def execute(self, draft, message_id, name, args, request):
        if name == "list_library_assets":
            return {
                "assets": [describe_asset(a) for a in await self.library.repository.list_ready()]
            }
        if name == "create_library_asset":
            allowed = {a.id for m in draft.chat_history for a in m.attachments}
            if args["attachment_id"] not in allowed:
                raise ValueError("Attachment is not in this project's chat history")
            asset = await self.attachments.publish(draft.id, args["attachment_id"], None, request)
            return {"id": asset.id, "name": asset.name, "format": asset.format}
        if name == "get_generation_job":
            return await self.job(args["job_id"])
        if name == "start_image_generation":
            key = hashlib.sha256(
                json.dumps([draft.id, message_id, args], sort_keys=True).encode()
            ).hexdigest()
            async with self.sessions() as session:
                previous = await session.scalar(
                    select(JobRecord.id).where(JobRecord.request_key == key)
                )
            if previous:
                return await self.job(previous)
            anchor_id = args["replace_anchor_id"]
            anchor = draft.anchors.get(anchor_id) if anchor_id else None
            if anchor_id and anchor is None:
                raise ValueError("Replacement anchor not found")
            if anchor and anchor.lift <= 0:
                raise ValueError("Set a positive anchor height before generation")
            intent = (
                {
                    "project_id": draft.id,
                    "anchor": anchor.model_dump(mode="json"),
                    "status": "pending",
                }
                if anchor
                else None
            )
            job = await self.jobs.create(
                JobCreate(
                    type="generation",
                    input={"image_asset_id": args["image_asset_id"]},
                    start=True,
                    name=args["name"],
                ),
                scene_placement=intent,
                request_key=key,
            )
            return await self.job(job.id)
        if name in {"fit_library_asset_to_anchor", "replace_anchor_with_asset"}:
            asset = await self.library.get_record(args["library_asset_id"])
            if asset.status != "ready" or asset.format not in {"ply", "sog"}:
                raise ValueError("Expected a ready 3DGS library asset")
            anchor = draft.anchors.get(args["anchor_id"])
            if anchor is None:
                raise ValueError("Anchor not found")
            if name == "fit_library_asset_to_anchor":
                transform = fit_asset_to_anchor(
                    anchor,
                    BoundingBox.model_validate(asset.bbox) if asset.bbox else None,
                    tuple(getattr(asset, f"default_rotation_{a}_deg") for a in "xyz"),
                )
                return transform.model_dump(exclude_unset=True)
            async with self.sessions.begin() as session:
                await session.execute(text("BEGIN IMMEDIATE"))
                locked_asset = await session.get(LibraryAssetRecord, asset.id)
                if locked_asset is None:
                    raise ValueError("Library asset was removed")
                record = await replace_anchor(
                    session, draft.id, anchor.id, locked_asset, draft.revision
                )
            return {"scene_object_id": record.id, "removed_anchor_id": anchor.id}
        if name == "create_scene_primitive":
            primitive = ScenePrimitive(
                **{key: args[key] for key in ("type", "color") if args.get(key) is not None}
            )
            data = SceneObjectCreate(
                primitive=primitive.model_dump_json(),
                **{key: args[key] for key in ("parent_id", "position", "quaternion", "scale")},
            )
            obj, _ = await self.scene_objects.add(draft.id, data, draft.revision, request)
            return obj.model_dump(mode="json")
        if name == "create_scene_object":
            obj, _ = await self.scene_objects.add(
                draft.id, SceneObjectCreate(**args), draft.revision, request
            )
            return obj.model_dump(mode="json")
        if name == "update_scene_object":
            obj, _ = await self.scene_objects.update(
                draft.id,
                args["id"],
                SceneObjectUpdate(**{k: v for k, v in args.items() if k != "id" and v is not None}),
                draft.revision,
                request,
            )
            return obj.model_dump(mode="json")
        if name == "delete_scene_object":
            await self.scene_objects.remove(draft.id, args["id"], draft.revision)
            return {"removed_scene_object_id": args["id"]}
        if name == "delete_anchor":
            await AnchorService(self.repository).delete_anchor(draft.id, args["id"])
            return {"removed_anchor_id": args["id"]}
        raise ValueError(f"Unknown scene tool {name}")
