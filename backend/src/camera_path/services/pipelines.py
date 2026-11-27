"""Durable definitions, checkpoints and committed SSE events."""

import hashlib
import json
from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select, text

from camera_path.persistence.records import (
    JobRecord,
    LibraryAssetRecord,
    PipelineEventRecord,
    PipelineRecord,
)
from camera_path.services.pipeline_contract import validate_definition
from camera_path.services.pipeline_models import Pipeline, PipelineDefinition, PipelineStepRun


class PipelineService:
    def __init__(self, repository):
        self.repository = repository
        self.sessions = repository.session_factory

    @staticmethod
    def model(record):
        return Pipeline(
            **{
                key: getattr(record, key)
                for key in (
                    "id",
                    "project_id",
                    "message_id",
                    "definition",
                    "status",
                    "steps",
                    "created_at",
                    "updated_at",
                    "version",
                )
            }
        )

    def event(self, session, record, step_id=None):
        session.add(
            PipelineEventRecord(
                project_id=record.project_id,
                pipeline_id=record.id,
                payload={
                    "pipeline": self.model(record).model_dump(mode="json"),
                    "step_id": step_id,
                },
            )
        )

    async def create(self, project_id, message_id, definition, *, request_key=None):
        definition = PipelineDefinition.model_validate(definition)
        validate_definition(definition)
        project = await self.repository.get(project_id)
        if not any(m.id == message_id for m in project.chat_history):
            raise ValueError("The source message must belong to this project's chat")
        spec = definition.model_dump(mode="json")
        key = (
            request_key
            or hashlib.sha256(
                json.dumps([project_id, message_id, spec], sort_keys=True).encode()
            ).hexdigest()
        )
        # Capture actual anchor identities/transforms, not a fragile project-wide revision.
        anchors = {key: anchor.model_dump(mode="json") for key, anchor in project.anchors.items()}
        now = datetime.now(UTC)
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            existing = await session.scalar(
                select(PipelineRecord).where(PipelineRecord.request_key == key)
            )
            if existing:
                return self.model(existing)
            published = set()
            for step in definition.steps:
                if step.command in {"publish_chat_image", "create_library_asset"}:
                    attachment_id = step.input.get("attachment_id")
                    if isinstance(attachment_id, str):
                        published.add(attachment_id)
                if step.command == "generate_model":
                    image_id = step.input.get("image_asset_id")
                    if isinstance(image_id, str) and image_id not in published:
                        image = await session.get(LibraryAssetRecord, image_id)
                        if image is None or image.status != "ready":
                            raise ValueError(
                                "Chat images must be published first: add publish_chat_image "
                                "and reference its asset_id."
                            )
            record = PipelineRecord(
                id=str(uuid4()),
                project_id=project_id,
                message_id=message_id,
                request_key=key,
                definition=spec,
                context={"anchors": anchors},
                steps=[PipelineStepRun(id=s.id).model_dump(mode="json") for s in definition.steps],
                status="queued" if definition.start_mode == "auto" else "awaiting_confirmation",
                created_at=now,
                updated_at=now,
                version=1,
                lease_until=0,
            )
            session.add(record)
            await session.flush()
            self.event(session, record)
        return self.model(record)

    async def record(self, session, project_id, pipeline_id):
        record = await session.get(PipelineRecord, pipeline_id)
        if record is None or record.project_id != project_id:
            raise HTTPException(404, "Pipeline not found in this project")
        return record

    async def get(self, project_id, pipeline_id):
        async with self.sessions() as session:
            return self.model(await self.record(session, project_id, pipeline_id))

    async def list(self, project_id):
        await self.repository.get(project_id)
        async with self.sessions() as session:
            rows = await session.scalars(
                select(PipelineRecord)
                .where(PipelineRecord.project_id == project_id)
                .order_by(PipelineRecord.created_at, PipelineRecord.id)
            )
            return [self.model(row) for row in rows]

    async def confirm(self, project_id, pipeline_id):
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            record = await self.record(session, project_id, pipeline_id)
            if record.status == "awaiting_confirmation":
                record.status = "queued"
                record.version += 1
                record.updated_at = datetime.now(UTC)
                self.event(session, record)
        return self.model(record)

    async def checkpoint(self, session, pipeline_id, owner, index, **patch):
        record = await session.get(PipelineRecord, pipeline_id, populate_existing=True)
        if record is None or record.lease_owner != owner:
            raise RuntimeError("Pipeline execution lease lost")
        states = deepcopy(record.steps)
        states[index].update(patch)
        record.steps = states
        record.updated_at = datetime.now(UTC)
        record.version += 1
        record.status = (
            "failed"
            if patch.get("status") == "failed"
            else "succeeded"
            if all(s["status"] == "succeeded" for s in states)
            else "running"
        )
        command = record.definition["steps"][index]["command"]
        if patch.get("status") == "failed" or (
            patch.get("status") == "succeeded"
            and command in {"place_model", "replace_anchor_with_asset"}
        ):
            jobs = await session.scalars(
                select(JobRecord).where(
                    JobRecord.scene_placement["pipeline_id"].as_string() == pipeline_id
                )
            )
            for job in jobs:
                intent = job.scene_placement
                target_anchor = (states[index].get("input") or {}).get("anchor_id")
                if (
                    intent
                    and intent.get("status") == "pending"
                    and (patch.get("status") == "failed" or intent["anchor"]["id"] == target_anchor)
                ):
                    job.scene_placement = {
                        **intent,
                        **(
                            {"status": "skipped", "reason": patch["error"]["message"]}
                            if patch.get("status") == "failed"
                            else {
                                "status": "succeeded",
                                "scene_object_id": patch["output"]["scene_object_id"],
                            }
                        ),
                    }
        self.event(session, record, states[index]["id"])

    async def job_phase(self, job_id, phase):
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            records = await session.scalars(
                select(PipelineRecord).where(PipelineRecord.status == "running")
            )
            for record in records:
                states = deepcopy(record.steps)
                for state in states:
                    if (
                        state.get("job_id") == job_id
                        and state["status"] == "waiting"
                        and state.get("phase") != phase
                    ):
                        state["phase"] = phase
                        record.steps = states
                        record.version += 1
                        record.updated_at = datetime.now(UTC)
                        self.event(session, record, state["id"])

    async def cursor(self, project_id):
        async with self.sessions() as session:
            return (
                await session.scalar(
                    select(func.max(PipelineEventRecord.id)).where(
                        PipelineEventRecord.project_id == project_id
                    )
                )
                or 0
            )

    async def events(self, project_id, after):
        async with self.sessions() as session:
            rows = await session.scalars(
                select(PipelineEventRecord)
                .where(PipelineEventRecord.project_id == project_id, PipelineEventRecord.id > after)
                .order_by(PipelineEventRecord.id)
                .limit(100)
            )
            return [(row.id, row.payload) for row in rows]
