"""Real persistence/executor tests; provider responses are the only substituted boundary."""

import hashlib
import io
import json
from uuid import uuid4

import pytest
from conftest import create_editor_app
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from jsonschema import ValidationError
from PIL import Image
from sqlalchemy import select

from camera_path.config import Settings
from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.models import AnchorCreate, AnchorUpdate, ProjectCreate
from camera_path.persistence.records import JobRecord, PipelineRecord
from camera_path.services.job_completion import JobCompletionService
from camera_path.services.job_completion_models import JobCompletionMessage
from camera_path.services.pipeline_contract import agent_pipeline_tools
from camera_path.services.pipeline_models import PipelineDefinition


@pytest.fixture
async def pipeline_app(tmp_path):
    app = create_editor_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "library",
            message_queue="none",
        )
    )
    await app.state.project_repository.initialize()
    app.state.job_service.generation_enabled = True
    project = await app.state.project_service.create_project(ProjectCreate())
    project = await app.state.chat_service.save_user_message(
        project.id, "message-1", "Create a model"
    )
    yield app, project
    await app.state.project_repository.close()


def definition(steps, mode="auto"):
    return PipelineDefinition(title="Test pipeline", start_mode=mode, steps=steps)


def step(name, command, **parameters):
    return {"id": name, "command": command, "input": parameters}


async def create(app, project, steps, mode="auto"):
    return await app.state.pipeline_service.create(project.id, "message-1", definition(steps, mode))


async def report(app, project, pipeline):
    return await app.state.pipeline_service.get(project.id, pipeline.id)


def primitive(name="cube"):
    return step(
        name,
        "create_scene_primitive",
        type="cube",
        color=None,
        parent_id=None,
        position=[0, 0, 0],
        quaternion=[0, 0, 0, 1],
        scale=[1, 1, 1],
    )


async def test_chained_commands_refs_committed_events_and_replay(pipeline_app):
    app, project = pipeline_app
    pipeline = await create(
        app,
        project,
        [
            primitive(),
            step(
                "move",
                "update_scene_object",
                id={"$ref": "cube.scene_object_id"},
                position=[2, 0, 3],
                quaternion=None,
                scale=None,
            ),
        ],
    )
    assert (await create(app, project, pipeline.definition.steps)).id == pipeline.id
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "succeeded", result.model_dump()
    assert result.steps[1].input["id"] == result.steps[0].output["id"]
    objects, _ = await app.state.scene_object_service.repository.list(project.id)
    assert len(objects) == 1 and objects[0].position_x == 2
    events = await app.state.pipeline_service.events(project.id, 0)
    finished = [
        e
        for _, e in events
        if e["step_id"]
        and any(
            s["id"] == e["step_id"] and s["status"] == "succeeded" for s in e["pipeline"]["steps"]
        )
    ]
    assert [e["step_id"] for e in finished] == ["cube", "move"]
    await app.state.pipeline_executor.process(pipeline.id)
    assert len((await app.state.scene_object_service.repository.list(project.id))[0]) == 1


async def test_confirmation_exactly_one_execution_and_project_scope(pipeline_app):
    app, project = pipeline_app
    pipeline = await create(app, project, [primitive()], "wait_for_confirmation")
    await app.state.pipeline_executor.process(pipeline.id)
    assert (await report(app, project, pipeline)).status == "awaiting_confirmation"
    await app.state.pipeline_service.confirm(project.id, pipeline.id)
    await app.state.pipeline_service.confirm(project.id, pipeline.id)
    await app.state.pipeline_executor.process(pipeline.id)
    assert (await report(app, project, pipeline)).status == "succeeded"
    other = await app.state.project_service.create_project(ProjectCreate())
    with pytest.raises(HTTPException, match="Pipeline not found"):
        await app.state.pipeline_service.confirm(other.id, pipeline.id)


@pytest.mark.parametrize(
    "steps",
    [
        [step("bad", "execute_python", code="print(1)")],
        [primitive(), primitive()],
        [step("move", "delete_scene_object", id={"$ref": "later.id"}), primitive("later")],
        [step("bad", "set_default_speed", speed="not a number")],
        [step("bad", "set_default_speed", speed={"$ref": "bad.id"})],
    ],
)
async def test_invalid_definitions_never_run(pipeline_app, steps):
    app, project = pipeline_app
    with pytest.raises((ValueError, ValidationError)):
        await create(app, project, steps)
    assert await app.state.pipeline_service.list(project.id) == []


async def test_failure_keeps_completed_results_and_skips_following_steps(pipeline_app):
    app, project = pipeline_app
    pipeline = await create(
        app,
        project,
        [
            primitive(),
            step("remove", "delete_scene_object", id="missing"),
            step("speed", "set_default_speed", speed=3),
        ],
    )
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "failed"
    assert [s.status for s in result.steps] == ["succeeded", "failed", "pending"]
    assert len((await app.state.scene_object_service.repository.list(project.id))[0]) == 1


async def test_mutation_and_checkpoint_roll_back_together(pipeline_app, monkeypatch):
    app, project = pipeline_app
    service = app.state.pipeline_service
    original = service.checkpoint

    async def fail_once(session, *args, **patch):
        if patch.get("status") == "succeeded":
            raise ValueError("Cannot save checkpoint")
        return await original(session, *args, **patch)

    monkeypatch.setattr(service, "checkpoint", fail_once)
    pipeline = await create(app, project, [primitive()])
    await app.state.pipeline_executor.process(pipeline.id)
    assert (await report(app, project, pipeline)).status == "failed"
    assert (await app.state.scene_object_service.repository.list(project.id))[0] == []


async def test_semantic_command_uses_pipeline_and_checkpoints(pipeline_app):
    app, project = pipeline_app
    pipeline = await create(app, project, [step("speed", "set_default_speed", speed=3.5)])
    await app.state.pipeline_executor.process(pipeline.id)
    assert (await report(app, project, pipeline)).status == "succeeded"
    assert (await app.state.project_repository.get(project.id)).motion_profile.default_speed == 3.5


async def complete_model(app, job_id, tmp_path):
    output = LocalLibraryStorage(tmp_path / "out")
    raw = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"
    output.write_object("model.ply", io.BytesIO(raw))
    message = JobCompletionMessage.model_validate(
        {
            "schema_version": 2,
            "message_id": str(uuid4()),
            "job_id": job_id,
            "assets": [
                {
                    "name": "Chair",
                    "primary_file_id": "main",
                    "bbox": {"min": [-1, 0, -1], "max": [1, 2, 1]},
                    "files": [
                        {
                            "id": "main",
                            "format": "ply",
                            "size_bytes": len(raw),
                            "sha256": hashlib.sha256(raw).hexdigest(),
                            "source": {"storage": "out", "path": "model.ply"},
                        }
                    ],
                }
            ],
        }
    )
    await JobCompletionService(app.state.library_service, {"out": output}).register(message)


async def test_text_generation_waits_for_import_and_reuses_job_on_recovery(pipeline_app, tmp_path):
    app, project = pipeline_app
    pipeline = await create(app, project, [step("model", "generate_model", prompt="A chair")])
    await app.state.pipeline_executor.process(pipeline.id)
    first = await report(app, project, pipeline)
    assert first.steps[0].status == "waiting"
    job_id = first.steps[0].job_id
    await app.state.pipeline_service.job_phase(job_id, "generating")
    generating = await report(app, project, pipeline)
    assert generating.steps[0].phase == "generating"
    version = generating.version
    await app.state.pipeline_service.job_phase(job_id, "generating")
    assert (await report(app, project, pipeline)).version == version
    await app.state.pipeline_service.job_phase(job_id, "importing")
    assert (await report(app, project, pipeline)).steps[0].phase == "importing"
    await app.state.pipeline_executor.process(pipeline.id)
    assert (await report(app, project, pipeline)).steps[0].job_id == job_id
    async with app.state.project_repository.session_factory() as session:
        assert len(list(await session.scalars(select(JobRecord)))) == 1
    await complete_model(app, job_id, tmp_path)
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "succeeded"
    assert result.steps[0].output["asset_id"]


@pytest.mark.parametrize("fit,keep_anchor", [(True, False), (False, False), (True, True)])
async def test_generation_and_placement_with_optional_fit(pipeline_app, tmp_path, fit, keep_anchor):
    app, project = pipeline_app
    project = await app.state.anchor_service.add_anchor(
        project.id, AnchorCreate(label="A", surface_position=[2, 0, 3], lift=4)
    )
    anchor_id = next(iter(project.anchors))
    pipeline = await create(
        app,
        project,
        [
            step("model", "generate_model", prompt="A chair"),
            step(
                "place",
                "place_model",
                library_asset_id={"$ref": "model.asset_id"},
                anchor_id=anchor_id,
                fit_to_anchor=fit,
                replace_anchor=not keep_anchor,
            ),
        ],
    )
    await app.state.pipeline_executor.process(pipeline.id)
    waiting = await report(app, project, pipeline)
    await complete_model(app, waiting.steps[0].job_id, tmp_path)
    # Import must not execute the pipeline's replacement behind the executor's back.
    assert anchor_id in (await app.state.project_repository.get(project.id)).anchors
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "succeeded", result.model_dump()
    objects, _ = await app.state.scene_object_service.repository.list(project.id)
    assert len(objects) == 1
    assert objects[0].position_x == 2 and objects[0].position_z == 3
    assert objects[0].scale_y == (2 if fit else 1)
    assert (
        anchor_id in (await app.state.project_repository.get(project.id)).anchors
    ) == keep_anchor


async def test_changed_anchor_preserves_generated_model_and_stops_placement(pipeline_app, tmp_path):
    app, project = pipeline_app
    project = await app.state.anchor_service.add_anchor(
        project.id, AnchorCreate(label="A", surface_position=[0, 0, 0], lift=2)
    )
    anchor_id = next(iter(project.anchors))
    pipeline = await create(
        app,
        project,
        [
            step("model", "generate_model", prompt="A chair"),
            step(
                "place",
                "replace_anchor_with_asset",
                library_asset_id={"$ref": "model.asset_id"},
                anchor_id=anchor_id,
            ),
        ],
    )
    await app.state.pipeline_executor.process(pipeline.id)
    waiting = await report(app, project, pipeline)
    await app.state.anchor_service.update_anchor(project.id, anchor_id, AnchorUpdate(lift=5))
    await complete_model(app, waiting.steps[0].job_id, tmp_path)
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "failed"
    assert result.steps[0].status == "succeeded" and result.steps[1].status == "failed"
    assert len(await app.state.library_service.repository.list_ready()) == 1
    assert anchor_id in (await app.state.project_repository.get(project.id)).anchors
    assert (await app.state.scene_object_service.repository.list(project.id))[0] == []


async def test_interrupted_image_request_is_not_automatically_billed_again(
    pipeline_app, monkeypatch
):
    app, project = pipeline_app
    pipeline = await create(app, project, [step("image", "generate_image", prompt="A chair")])
    async with app.state.project_repository.session_factory.begin() as session:
        record = await session.get(PipelineRecord, pipeline.id)
        record.steps = [{**record.steps[0], "status": "running", "phase": "image_request"}]
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "failed"
    assert "outcome is unknown" in result.steps[0].error["message"]


async def test_resolved_wrong_type_fails_before_next_mutation(pipeline_app):
    app, project = pipeline_app
    pipeline = await create(
        app, project, [primitive(), step("speed", "set_default_speed", speed={"$ref": "cube.id"})]
    )
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert [s.status for s in result.steps] == ["succeeded", "failed"]


async def test_generated_image_stays_staged_and_can_be_edited(pipeline_app, monkeypatch):
    app, project = pipeline_app
    generated = []

    async def fake_generate(project_id, attachment_id, parameters):
        raw = io.BytesIO()
        Image.new("RGBA", (8, 8), (255, 0, 0, 0)).save(raw, format="PNG")
        generated.append(parameters)
        return await app.state.pipeline_executor.images.save(
            project_id, attachment_id, "Chair.png", raw.getvalue()
        )

    monkeypatch.setattr(app.state.pipeline_executor.images, "generate", fake_generate)
    pipeline = await create(
        app,
        project,
        [
            step("image", "generate_image", prompt="A chair"),
            step(
                "edit",
                "generate_image",
                prompt="Make it blue",
                source_attachment_id={"$ref": "image.attachment_id"},
            ),
        ],
    )
    await app.state.pipeline_executor.process(pipeline.id)
    result = await report(app, project, pipeline)
    assert result.status == "succeeded", result.model_dump()
    assert generated[1]["source_attachment_id"] == result.steps[0].output["attachment_id"]
    assert await app.state.library_service.repository.list_ready() == []
    assert (await app.state.pipeline_service.list(project.id))[0].steps[1].output["image"][
        "name"
    ] == "Chair.png"


async def test_live_agent_only_exposes_mutations_through_pipeline(pipeline_app):
    app, project = pipeline_app
    agent = app.state.trajectory_agent
    names = {t["name"] for t in agent.available_tools()}
    assert {"submit_pipeline", "confirm_pipeline", "get_project_state"} <= names
    assert "create_scene_primitive" not in names
    schema = next(t for t in agent_pipeline_tools() if t["name"] == "submit_pipeline")["parameters"]
    assert schema["additionalProperties"] is False
    _, _, output = await agent._run_tool(
        project,
        project.revision,
        "message-1",
        "submit_pipeline",
        json.dumps({"definition": definition([primitive()]).model_dump()}),
        None,
    )
    assert output["status"] == "queued"
    async with app.state.project_repository.session_factory() as session:
        assert len(list(await session.scalars(select(PipelineRecord)))) == 1


async def test_pipeline_api_validates_and_exports_report(pipeline_app):
    app, project = pipeline_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        url = f"/api/v1/projects/{project.id}/pipelines"
        headers = {"If-Match": f'"{project.revision}"'}
        bad = await client.post(
            url,
            headers=headers,
            json={
                "message_id": "message-1",
                "definition": definition([step("bad", "unknown")]).model_dump(),
            },
        )
        assert bad.status_code == 422, bad.text
        created = await client.post(
            url,
            headers=headers,
            json={
                "message_id": "message-1",
                "definition": definition([primitive()], "wait_for_confirmation").model_dump(),
            },
        )
        assert created.status_code == 201, created.text
        pipeline_id = created.json()["id"]
        confirmed = await client.post(f"{url}/{pipeline_id}/confirm", headers=headers)
        assert confirmed.status_code == 200
        await app.state.pipeline_executor.process(pipeline_id)
        result = await client.get(f"{url}/{pipeline_id}")
        assert result.json()["steps"][0]["output"]["scene_object_id"]
