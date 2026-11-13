"""Real persistence and generation contracts; no provider token or external requests."""

import io
import json
from types import SimpleNamespace

import pytest
from conftest import create_editor_app
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from PIL import Image

from camera_path.config import Settings
from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.models import Anchor, AnchorUpdate
from camera_path.services.anchor_asset_fit import fit_asset_to_anchor
from camera_path.services.generation_integration import GenerationIntegration
from camera_path.services.generation_models import GenerationResult
from camera_path.services.job_completion import JobCompletionService
from camera_path.services.library_metadata import BoundingBox
from camera_path.services.scene_transforms import transformed_offset


@pytest.fixture
async def scene(tmp_path):
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        project = (await client.post("/projects", json={})).json()
        project = (
            await client.post(
                f"/projects/{project['id']}/anchors",
                json={"label": "A", "surface_position": [3, 0, 4], "lift": 2},
            )
        ).json()
        request = Request(
            {
                "type": "http",
                "app": app,
                "router": app.router,
                "scheme": "http",
                "server": ("test", 80),
                "path": "/",
                "root_path": "",
                "headers": [],
            }
        )
        yield app, client, project, request
    await app.state.project_repository.close()


async def attach(scene):
    _, client, project, _ = scene
    image = io.BytesIO()
    Image.new("RGB", (4, 5), "red").save(image, format="PNG")
    raw = image.getvalue()
    url = f"/api/v1/projects/{project['id']}/chat/attachments"
    upload = await client.post(
        url, json={"name": "chair.png", "format": "png", "size_bytes": len(raw)}
    )
    assert upload.status_code == 201, upload.text
    pending = upload.json()
    assert (await client.put(pending["upload_url"], content=raw)).status_code == 204
    ready = await client.post(f"{url}/{pending['id']}/complete")
    assert ready.status_code == 200, ready.text
    return ready.json(), raw


async def test_staged_image_selection_and_message_retry(scene):
    app, client, project, _ = scene
    image, raw = await attach(scene)
    anchor_id = next(iter(project["anchors"]))
    url = f"/api/v1/projects/{project['id']}/chat/user-messages"
    payload = {
        "id": "m1",
        "message": "replace it",
        "selected_object_id": f"anchor:{anchor_id}",
        "attachment_ids": [image["id"]],
    }
    saved = await client.post(url, json=payload, headers={"If-Match": f'"{project["revision"]}"'})
    assert saved.status_code == 201, saved.text
    assert saved.json()["selected_object"]["name"] == "A"
    assert saved.json()["attachments"][0]["name"] == "chair.png"
    current = await app.state.project_repository.get(project["id"])
    retry = await client.post(url, json=payload, headers={"If-Match": f'"{current.revision}"'})
    assert retry.status_code == 201
    assert await app.state.library_service.repository.list_ready() == []
    assert (await client.get(image["url"])).content == raw
    conflict = await client.post(
        url,
        json={**payload, "selected_object_id": None},
        headers={"If-Match": f'"{current.revision}"'},
    )
    assert conflict.status_code == 409
    other = (await client.post("/projects", json={})).json()
    assert (
        await client.get(f"/api/v1/projects/{other['id']}/chat/attachments/{image['id']}/content")
    ).status_code == 404


async def test_attachment_publication_and_agent_context_without_provider(scene, monkeypatch):
    app, _, project, request = scene
    image, _ = await attach(scene)
    anchor_id = next(iter(project["anchors"]))
    calls = []

    class Responses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                return SimpleNamespace(
                    output=[
                        SimpleNamespace(
                            type="function_call",
                            name="submit_pipeline",
                            arguments=json.dumps(
                                {
                                    "definition": {
                                        "title": "Publish original image",
                                        "steps": [
                                            {
                                                "id": "image",
                                                "command": "publish_chat_image",
                                                "input": {"attachment_id": image["id"]},
                                            }
                                        ],
                                    }
                                }
                            ),
                            call_id="call1",
                        )
                    ],
                    output_text="",
                )
            return SimpleNamespace(output=[], output_text="Image publication queued")

    monkeypatch.setattr(
        "camera_path.agent.trajectory_agent.AsyncOpenAI",
        lambda **_: SimpleNamespace(responses=Responses()),
    )
    agent = app.state.trajectory_agent
    agent.api_key = "fake-only-no-network"
    result = await agent.handle(
        project["id"], "save this image", "m1", f"anchor:{anchor_id}", [image["id"]], request
    )
    assert result.answer == "Image publication queued"
    assert calls[0]["input"][0]["content"][1]["type"] == "input_image"
    assert "anchor:" + anchor_id in calls[0]["input"][0]["content"][0]["text"]
    pipelines = await app.state.pipeline_service.list(project["id"])
    assert len(pipelines) == 1
    assert await app.state.library_service.repository.list_ready() == []
    await app.state.pipeline_executor.process(pipelines[0].id)
    assert len(await app.state.library_service.repository.list_ready()) == 1
    draft = await app.state.project_repository.get(project["id"])
    tools = agent.scene_tools
    first = await tools.execute(
        draft, "m1", "create_library_asset", {"attachment_id": image["id"]}, request
    )
    assert first["id"] == image["id"]
    assert len(await app.state.library_service.repository.list_ready()) == 1


@pytest.mark.parametrize("changed", [False, True, "removed", "referenced"])
async def test_durable_generation_replacement_and_replay(scene, tmp_path, changed):
    app, client, project, request = scene
    image, _ = await attach(scene)
    anchor_id = next(iter(project["anchors"]))
    draft = await app.state.chat_service.save_user_message(
        project["id"], "m1", "generate and replace", f"anchor:{anchor_id}", [image["id"]]
    )
    tools = app.state.trajectory_agent.scene_tools
    await tools.execute(
        draft, "m1", "create_library_asset", {"attachment_id": image["id"]}, request
    )
    args = {"image_asset_id": image["id"], "replace_anchor_id": anchor_id, "name": None}
    job = await tools.execute(draft, "m1", "start_image_generation", args, request)
    assert (await tools.execute(draft, "m1", "start_image_generation", args, request))["id"] == job[
        "id"
    ]
    if changed == "removed":
        await app.state.anchor_service.delete_anchor(project["id"], anchor_id)
    elif changed == "referenced":
        second = (
            await client.post(
                f"/projects/{project['id']}/anchors",
                json={"label": "B", "surface_position": [10, 0, 0], "lift": 2},
            )
        ).json()
        other_id = next(key for key in second["anchors"] if key != anchor_id)
        response = await client.post(
            f"/projects/{project['id']}/segments/spline", json={"anchor_ids": [anchor_id, other_id]}
        )
        assert response.status_code == 200
    elif changed:
        await app.state.anchor_service.update_anchor(project["id"], anchor_id, AnchorUpdate(lift=3))
    output = LocalLibraryStorage(tmp_path / "output")
    raw = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"
    output.write_object(f"{job['id']}/result.ply", io.BytesIO(raw))
    # Construct the worker input through the real staging adapter, not a guessed path.
    integration = GenerationIntegration(
        None,
        JobCompletionService(app.state.library_service, {"generation": output}),
        output,
        default_rotation_deg=(180, 0, 0),
    )
    worker_input, _ = await integration._worker_input(
        job["id"], {"image_asset_id": image["id"]}, stage=True
    )
    manifest = {
        "schema_version": 1,
        "job_id": job["id"],
        "input": worker_input.model_dump(),
        "files": [f"{job['id']}/result.ply"],
        "bbox": {"min": [-1, -1, -1], "max": [1, 1, 1]},
    }
    output.write_object(f"{job['id']}/result.json", io.BytesIO(json.dumps(manifest).encode()))
    event = GenerationResult(
        schema_version=1,
        job_id=job["id"],
        status="succeeded",
        result_path=f"{job['id']}/result.json",
    )
    await integration.register(event)
    await integration.register(event)
    result = await tools.job(job["id"])
    assert result["status"] == "succeeded"
    assert len(result["assets"]) == 1
    assert result["assets"][0]["bbox"] == manifest["bbox"]
    objects, _ = await app.state.scene_object_service.repository.list(project["id"])
    anchors = (await app.state.project_repository.get(project["id"])).anchors
    if changed:
        assert result["scene_placement"]["status"] == "skipped"
        assert objects == []
        assert (anchor_id in anchors) == (changed != "removed")
    else:
        assert result["scene_placement"]["status"] == "succeeded"
        assert len(objects) == 1
        assert anchor_id not in anchors
        assert [
            objects[0].position_x,
            objects[0].position_y,
            objects[0].position_z,
        ] == pytest.approx([3, 1, 4])


@pytest.mark.parametrize("normal", [(0, 1, 0), (1, 0, 0), (0, -1, 0)])
def test_fit_rotated_bbox_bottom_and_top_align_to_anchor(normal):
    anchor = Anchor(
        label="A",
        surface_position=(3, 4, 5),
        surface_normal=normal,
        lift_axis="surface_normal",
        lift=6,
    )
    bbox = BoundingBox(min=(-2, -1, -3), max=(2, 2, 1))
    transform = fit_asset_to_anchor(anchor, bbox, (180, 0, 0))
    import itertools

    world = [
        tuple(transform.position[i] + p[i] for i in range(3))
        for p in [
            transformed_offset(transform.quaternion, transform.scale, corner)
            for corner in itertools.product(*zip(bbox.min, bbox.max, strict=True))
        ]
    ]
    heights = [
        sum((p[i] - anchor.surface_position[i]) * normal[i] for i in range(3)) for p in world
    ]
    assert min(heights) == pytest.approx(0)
    assert max(heights) == pytest.approx(6)


async def test_chat_only_finish_preserves_background_scene_change(scene):
    app, _, project, _ = scene
    draft = await app.state.chat_service.save_user_message(project["id"], "reply", "generate")
    baseline = draft.model_copy(deep=True)
    anchor_id = next(iter(draft.anchors))
    await app.state.anchor_service.delete_anchor(project["id"], anchor_id)
    result = await app.state.trajectory_agent._finish(draft, draft.revision, "Queued", baseline)
    assert anchor_id not in result.project.anchors
    assert result.project.chat_history[-1].content == "Queued"


async def test_semantic_edits_are_not_rebased_over_concurrent_scene_change(scene):
    from camera_path.repositories import RevisionConflictError

    app, _, project, _ = scene
    draft = await app.state.chat_service.save_user_message(project["id"], "reply", "edit")
    baseline = draft.model_copy(deep=True)
    draft.motion_profile.default_speed = 3
    await app.state.anchor_service.delete_anchor(project["id"], next(iter(draft.anchors)))
    with pytest.raises(RevisionConflictError):
        await app.state.trajectory_agent._finish(draft, draft.revision, "Done", baseline)
    current = await app.state.project_repository.get(project["id"])
    assert not current.anchors and current.motion_profile.default_speed == 1


async def test_invalid_scene_tool_arguments_do_not_discard_pending_trajectory_edit(scene):
    app, _, project, request = scene
    draft = await app.state.chat_service.save_user_message(project["id"], "reply", "edit")
    draft.motion_profile.default_speed = 3
    candidate, revision, output = await app.state.trajectory_agent._run_tool(
        draft,
        draft.revision,
        "reply",
        "create_library_asset",
        '{"unknown":1}',
        request,
    )
    assert output["status"] == "error"
    assert revision == draft.revision and candidate.motion_profile.default_speed == 3


@pytest.mark.parametrize(
    "bbox,lift",
    [
        (None, 1),
        ({"min": [0, 0, 0], "max": [1, 0, 1]}, 1),
        ({"min": [0, 0, 0], "max": [1, 1, 1]}, 0),
    ],
)
def test_fit_rejects_missing_or_degenerate_geometry(bbox, lift):
    anchor = Anchor(label="A", surface_position=(0, 0, 0), lift=lift)
    with pytest.raises(ValueError):
        fit_asset_to_anchor(anchor, BoundingBox(**bbox) if bbox else None, (0, 0, 0))


async def test_failed_generation_preserves_anchor_and_original_image(scene, tmp_path):
    app, _, project, request = scene
    image, _ = await attach(scene)
    anchor_id = next(iter(project["anchors"]))
    draft = await app.state.chat_service.save_user_message(
        project["id"], "failure", "generate", f"anchor:{anchor_id}", [image["id"]]
    )
    tools = app.state.trajectory_agent.scene_tools
    await tools.execute(
        draft, "failure", "create_library_asset", {"attachment_id": image["id"]}, request
    )
    job = await tools.execute(
        draft,
        "failure",
        "start_image_generation",
        {"image_asset_id": image["id"], "replace_anchor_id": anchor_id, "name": None},
        request,
    )
    output = LocalLibraryStorage(tmp_path / "failed-output")
    integration = GenerationIntegration(
        None, JobCompletionService(app.state.library_service, {}), output, default_rotation_deg=None
    )
    await integration.register(
        GenerationResult(
            schema_version=1,
            job_id=job["id"],
            status="failed",
            error={"code": "generation_failed", "message": "fixture failure"},
        )
    )
    current = await app.state.project_repository.get(project["id"])
    assert anchor_id in current.anchors
    assert (await tools.job(job["id"]))["status"] == "failed"
    assert (await tools.job(job["id"]))["assets"] == []
    assert len(await app.state.library_service.repository.list_ready()) == 1


async def test_agent_creates_moves_and_deletes_primitives_without_library_or_provider(scene):
    app, client, project, request = scene
    tools = app.state.trajectory_agent.scene_tools
    for index, kind in enumerate(("cube", "sphere", "cone"), start=1):
        draft = await app.state.project_repository.get(project["id"])
        obj = await tools.execute(
            draft,
            "primitives",
            "create_scene_primitive",
            {
                "type": kind,
                "color": "#336699",
                "parent_id": None,
                "position": [index, 0, 0],
                "quaternion": [0, 0, 0, 1],
                "scale": [2, 1, 3],
            },
            request,
        )
        assert obj["name"] == f"{kind.capitalize()} {index:02d}"
        assert json.loads(obj["primitive"]) == {"type": kind, "color": "#336699"}
        assert obj["library_asset_id"] is None
    state = await tools.state(project["id"])
    assert [item["primitive"]["type"] for item in state] == ["cube", "sphere", "cone"]
    assert await app.state.library_service.repository.list_ready() == []
    draft = await app.state.project_repository.get(project["id"])
    moved = await tools.execute(
        draft,
        "primitives",
        "update_scene_object",
        {
            "id": obj["id"],
            "position": [8, 9, 10],
            "quaternion": None,
            "scale": None,
        },
        request,
    )
    assert moved["position"] == [8, 9, 10]
    draft = await app.state.project_repository.get(project["id"])
    await tools.execute(draft, "primitives", "delete_scene_object", {"id": obj["id"]}, request)
    response = await client.get(f"/api/v1/projects/{project['id']}/scene-objects")
    assert len(response.json()) == 2
