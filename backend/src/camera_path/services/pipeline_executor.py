"""Deterministic execution; checkpoints commit with database mutations."""

import asyncio
import logging
import time
from contextlib import suppress
from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid4, uuid5

from jsonschema import Draft202012Validator
from sqlalchemy import select, text, update

from camera_path.persistence.records import LibraryAssetRecord, PipelineRecord
from camera_path.repositories import RevisionConflictError
from camera_path.services.anchor_replacement import replace_anchor
from camera_path.services.jobs import JobCreate
from camera_path.services.pipeline_contract import command_schemas, resolve_input
from camera_path.services.pipeline_models import PipelineDefinition
from camera_path.services.scene_objects import SceneObjectCreate, SceneObjectUpdate
from camera_path.services.scene_primitives import ScenePrimitive

logger = logging.getLogger(__name__)
LEASE_SECONDS = 90


class PipelineExecutor:
    def __init__(self, pipelines, trajectory, scene_tools):
        self.pipelines, self.trajectory = pipelines, trajectory
        self.scene_tools = scene_tools
        self.jobs = scene_tools.jobs
        self.sessions = pipelines.sessions
        self.repository = pipelines.repository
        self.request = None

    async def run(self):
        active = {}
        try:
            while True:
                for key, task in list(active.items()):
                    if task.done():
                        if task.exception() is not None:
                            logger.error("Pipeline runner failed: %s", task.exception())
                        del active[key]
                async with self.sessions() as session:
                    ids = await session.scalars(
                        select(PipelineRecord.id)
                        .where(
                            PipelineRecord.status.in_(("queued", "running")),
                            PipelineRecord.lease_until < time.time(),
                        )
                        .order_by(PipelineRecord.created_at)
                        .limit(4)
                    )
                    for pipeline_id in ids:
                        if pipeline_id not in active and len(active) < 4:
                            active[pipeline_id] = asyncio.create_task(self.process(pipeline_id))
                await asyncio.sleep(0.25)
        finally:
            for task in active.values():
                task.cancel()
            await asyncio.gather(*active.values(), return_exceptions=True)

    async def _pulse(self, pipeline_id, owner):
        while True:
            await asyncio.sleep(15)
            async with self.sessions.begin() as session:
                changed = await session.execute(
                    update(PipelineRecord)
                    .where(
                        PipelineRecord.id == pipeline_id,
                        PipelineRecord.lease_owner == owner,
                    )
                    .values(lease_until=time.time() + LEASE_SECONDS)
                )
                if changed.rowcount != 1:
                    return

    async def _change(self, pipeline_id, owner, index, **patch):
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            await self.pipelines.checkpoint(session, pipeline_id, owner, index, **patch)

    async def process(self, pipeline_id):
        owner = str(uuid4())
        async with self.sessions.begin() as session:
            claimed = await session.execute(
                update(PipelineRecord)
                .where(
                    PipelineRecord.id == pipeline_id,
                    PipelineRecord.status.in_(("queued", "running")),
                    PipelineRecord.lease_until < time.time(),
                )
                .values(lease_owner=owner, lease_until=time.time() + LEASE_SECONDS)
            )
            if claimed.rowcount != 1:
                return
        pulse = asyncio.create_task(self._pulse(pipeline_id, owner))
        index = 0
        try:
            while True:
                async with self.sessions() as session:
                    record = await session.get(PipelineRecord, pipeline_id)
                    if record is None or record.status in {"failed", "succeeded"}:
                        return
                    spec = PipelineDefinition.model_validate(record.definition)
                    index = next(
                        i for i, s in enumerate(record.steps) if s["status"] != "succeeded"
                    )
                    state, context, project_id = (
                        record.steps[index],
                        record.context,
                        record.project_id,
                    )
                    outputs = {
                        s["id"]: s["output"] for s in record.steps if s["status"] == "succeeded"
                    }
                step = spec.steps[index]
                parameters = state.get("input") or resolve_input(step.input, outputs)
                Draft202012Validator(command_schemas()[step.command]).validate(parameters)
                if state["status"] == "pending":
                    await self._change(
                        pipeline_id,
                        owner,
                        index,
                        status="running",
                        input=parameters,
                        started_at=datetime.now(UTC).isoformat(),
                    )

                async def done(session, output, step_index=index):
                    await self.pipelines.checkpoint(
                        session,
                        pipeline_id,
                        owner,
                        step_index,
                        status="succeeded",
                        output=output,
                        phase=None,
                        completed_at=datetime.now(UTC).isoformat(),
                    )

                if step.command == "generate_model":
                    output = await self._generate_model(
                        pipeline_id,
                        owner,
                        index,
                        step,
                        parameters,
                        project_id,
                        spec,
                        outputs,
                        context,
                        state,
                    )
                    if output is None:
                        return
                    async with self.sessions.begin() as session:
                        await done(session, output)
                elif step.command == "generate_image":
                    output = await self._generate_image(
                        pipeline_id, owner, index, step, parameters, project_id, state
                    )
                    if output is None:
                        return
                    async with self.sessions.begin() as session:
                        await done(session, output)
                elif step.command in {"publish_chat_image", "create_library_asset"}:
                    asset = await self.scene_tools.attachments.publish(
                        project_id, parameters["attachment_id"], None, self.request
                    )
                    async with self.sessions.begin() as session:
                        await done(
                            session, {"asset_id": asset.id, "id": asset.id, "name": asset.name}
                        )
                else:
                    for attempt in range(3):
                        try:
                            await self._database_command(
                                project_id, step.command, parameters, context, done
                            )
                            break
                        except RevisionConflictError:
                            if attempt == 2:
                                raise
        except asyncio.CancelledError:
            raise
        except Exception as error:
            detail = str(getattr(error, "detail", error))
            logger.warning("Pipeline %s step %s failed: %s", pipeline_id, index, detail)
            await self._change(
                pipeline_id,
                owner,
                index,
                status="failed",
                error={"code": type(error).__name__, "message": detail[:1000]},
                completed_at=datetime.now(UTC).isoformat(),
            )
        finally:
            pulse.cancel()
            with suppress(asyncio.CancelledError):
                await pulse
            async with self.sessions.begin() as session:
                await session.execute(
                    update(PipelineRecord)
                    .where(
                        PipelineRecord.id == pipeline_id,
                        PipelineRecord.lease_owner == owner,
                    )
                    .values(lease_owner=None, lease_until=0)
                )

    async def _generate_model(
        self, pipeline_id, owner, index, step, parameters, project_id, spec, outputs, context, state
    ):
        payload = {
            k: parameters[k] for k in ("prompt", "image_asset_id") if parameters.get(k) is not None
        }
        key = f"pipeline:{pipeline_id}:{step.id}"
        job = await self.jobs.by_request_key(key)
        if job is None:
            intent = None
            for future in spec.steps[index + 1 :]:
                if future.command in {"place_model", "replace_anchor_with_asset"}:
                    anchor_id = future.input.get("anchor_id")
                    if isinstance(anchor_id, str):
                        anchor = context["anchors"].get(anchor_id)
                        if anchor is None:
                            raise ValueError("Replacement anchor not found")
                        intent = {
                            "project_id": project_id,
                            "anchor": anchor,
                            "status": "pending",
                            "pipeline_id": pipeline_id,
                        }
                    break
            job = await self.jobs.create(
                JobCreate(
                    type="generation", input=payload, start=True, name=parameters.get("name")
                ),
                scene_placement=intent,
                request_key=key,
            )
        return await self._job_result(pipeline_id, owner, index, job, state)

    async def _job_result(self, pipeline_id, owner, index, job, state):
        result = await self.jobs.result(job.id)
        if result is None and state.get("job_id") != job.id:
            await self._change(
                pipeline_id,
                owner,
                index,
                status="waiting",
                job_id=job.id,
                phase="queued" if job.status.value == "queued" else "generating",
            )
        return result

    async def _generate_image(self, pipeline_id, owner, index, step, parameters, project_id, state):
        key = f"pipeline:{pipeline_id}:{step.id}"
        job = await self.jobs.by_request_key(key)
        if job is None:
            # Preserve the old paid-request checkpoint when upgrading an existing database.
            if state.get("phase") == "image_request":
                raise ValueError(
                    "Image request was interrupted; its outcome is unknown. "
                    "Submit a new pipeline to retry."
                )
            attachment_id = str(uuid5(NAMESPACE_URL, key))
            job = await self.jobs.create_chat_image(project_id, attachment_id, parameters, key)
        result = await self._job_result(pipeline_id, owner, index, job, state)
        if result is None:
            return None
        image = await self.jobs.chat_image(job.id)
        return {
            **result,
            "attachment_id": image.id,
            "image": image.model_dump(),
            "anchor_id": parameters.get("anchor_id"),
        }

    async def _database_command(self, project_id, command, parameters, context, done):
        from camera_path.agent.trajectory_agent import TOOLS, TrajectoryAgent

        draft = await self.repository.get(project_id)
        semantic = {t["name"] for t in TOOLS}
        if command in semantic:
            output = TrajectoryAgent._execute(draft, command, parameters)

            async def checkpoint(session):
                await done(session, output)

            await self.trajectory.save_agent_draft(draft, draft.revision, on_commit=checkpoint)
            return
        if command == "delete_anchor":
            anchor_id = parameters["id"]
            if anchor_id not in draft.anchors:
                raise ValueError("Anchor not found")
            del draft.anchors[anchor_id]

            async def checkpoint(session):
                await done(session, {"removed_anchor_id": anchor_id})

            await self.trajectory.save_agent_draft(draft, draft.revision, on_commit=checkpoint)
            return
        scene = self.scene_tools.scene_objects

        async def scene_checkpoint(session, record):
            await done(
                session,
                {"id": record.id, "scene_object_id": record.id}
                if record
                else {"removed_scene_object_id": parameters["id"]},
            )

        if command in {"create_scene_object", "create_scene_primitive"}:
            if command == "create_scene_primitive":
                primitive = ScenePrimitive(
                    **{k: parameters[k] for k in ("type", "color") if parameters.get(k) is not None}
                )
                data = SceneObjectCreate(
                    primitive=primitive.model_dump_json(),
                    **{k: parameters[k] for k in ("parent_id", "position", "quaternion", "scale")},
                )
            else:
                data = SceneObjectCreate(**parameters)
            await scene.add(
                project_id, data, draft.revision, self.request, on_commit=scene_checkpoint
            )
        elif command == "update_scene_object":
            await scene.update(
                project_id,
                parameters["id"],
                SceneObjectUpdate(
                    **{k: v for k, v in parameters.items() if k != "id" and v is not None}
                ),
                draft.revision,
                self.request,
                on_commit=scene_checkpoint,
            )
        elif command == "delete_scene_object":
            await scene.remove(
                project_id, parameters["id"], draft.revision, on_commit=scene_checkpoint
            )
        elif command in {"place_model", "replace_anchor_with_asset", "fit_library_asset_to_anchor"}:
            anchor_id = parameters.get("anchor_id")
            if not anchor_id:
                await scene.add(
                    project_id,
                    SceneObjectCreate(library_asset_id=parameters["library_asset_id"]),
                    draft.revision,
                    self.request,
                    on_commit=scene_checkpoint,
                )
                return
            if command == "fit_library_asset_to_anchor":
                output = await self.scene_tools.execute(
                    draft, "", command, parameters, self.request
                )
                async with self.sessions.begin() as session:
                    await done(session, output)
                return
            async with self.sessions.begin() as session:
                await session.execute(text("BEGIN IMMEDIATE"))
                asset = await session.get(LibraryAssetRecord, parameters["library_asset_id"])
                if asset is None:
                    raise ValueError("Library asset no longer exists")
                snapshot = context["anchors"].get(anchor_id)
                if snapshot is None:
                    raise ValueError("Anchor was not present when pipeline was prepared")
                record = await replace_anchor(
                    session,
                    project_id,
                    anchor_id,
                    asset,
                    snapshot=snapshot,
                    fit_to_anchor=parameters.get("fit_to_anchor", True),
                    remove_anchor=command == "replace_anchor_with_asset"
                    or parameters.get("replace_anchor", False),
                )
                await scene_checkpoint(session, record)
        else:
            raise ValueError(f"Unsupported command: {command}")
