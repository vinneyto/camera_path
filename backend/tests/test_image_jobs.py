"""Real job persistence and imports; only inference/provider calls are substituted."""

import asyncio
import hashlib
import io
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient
from PIL import Image

from camera_path.config import Settings
from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.models import ProjectCreate
from camera_path.persistence.records import JobRecord
from camera_path.services.generation_models import GenerationResult
from camera_path.services.image_generation_models import PAINTER_MODEL, PAINTER_REVISION
from camera_path.services.library_metadata import LibraryError


def png():
    image = Image.new("RGBA", (16, 16))
    image.putpixel((8, 8), (255, 0, 0, 255))
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


@pytest.fixture
async def images(tmp_path):
    app = create_editor_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "library",
            message_queue="none",
        )
    )
    await app.state.project_repository.initialize()
    app.state.job_service.image_settings = {
        "provider": "openai",
        "model": "frozen-image-model",
        "width": 1024,
        "height": 1024,
    }
    app.state.image_jobs.generate = AsyncMock(return_value=png())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield app, client
    await app.state.project_repository.close()


async def create(client, **kwargs):
    response = await client.post(
        "/api/v1/jobs",
        json={
            "type": "image_generation",
            "input": {"prompt": "A red chair"},
            "start": True,
            **kwargs,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_openai_job_lifecycle_frozen_provider_png_preview_and_source_lock(images):
    app, client = images
    job = await create(client)
    app.state.job_service.image_settings = {"provider": "none", "model": "changed"}
    await asyncio.gather(*(app.state.image_jobs.process(job["id"]) for _ in range(3)))
    app.state.image_jobs.generate.assert_awaited_once()
    assert app.state.image_jobs.generate.call_args.args[0]["model"] == "frozen-image-model"
    done = (await client.get(f"/api/v1/jobs/{job['id']}")).json()
    assert done["status"] == "succeeded" and done["started_at"] and done["completed_at"]
    asset = done["assets"][0]
    assert asset["name"] == "A_red_chair.png" and asset["status"] == "ready"
    preview = await client.get(f"/api/v1/jobs/{job['id']}/image")
    assert preview.content == png() and preview.headers["content-type"] == "image/png"
    assert (await client.get(f"/api/v1/jobs/{job['id']}/source-image")).status_code == 404
    app.state.job_service.image_settings = {
        "provider": "openai",
        "model": "edit-model",
        "width": 1024,
        "height": 1024,
    }
    edit = await create(client, input={"prompt": "Make it blue", "image_asset_id": asset["id"]})
    assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 409
    assert (await client.get(f"/api/v1/jobs/{edit['id']}/source-image")).content == png()
    await app.state.image_jobs.process(edit["id"])
    assert app.state.image_jobs.generate.call_args.args[1] == (png(), "image/png")
    assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/jobs/{edit['id']}/source-image")).status_code == 404
    assert (await client.get(f"/api/v1/jobs/{edit['id']}")).json()["input_asset"] is None
    assert len((await client.get("/api/v1/jobs")).json()) == 2


@pytest.mark.parametrize("saved", [False, True])
async def test_interrupted_openai_request_never_rebills_and_can_import_saved_png(images, saved):
    app, client = images
    job = await create(client)
    async with app.state.job_service.sessions.begin() as session:
        record = await session.get(JobRecord, job["id"])
        record.execution = {**record.execution, "phase": "request_sent"}
        asset_id = app.state.image_jobs.images.asset_id(record)
    if saved:
        app.state.library_service.storage.write_object(asset_id + ".png", io.BytesIO(png()))
    await app.state.image_jobs.process(job["id"])
    app.state.image_jobs.generate.assert_not_awaited()
    done = (await client.get(f"/api/v1/jobs/{job['id']}")).json()
    assert done["status"] == ("succeeded" if saved else "failed")
    if not saved:
        assert "outcome is unknown" in done["error"]["message"]


async def test_failed_or_invalid_provider_output_has_no_partial_library_asset(images):
    app, client = images
    app.state.image_jobs.generate.side_effect = RuntimeError("private provider details")
    failed = await create(client)
    await app.state.image_jobs.process(failed["id"])
    result = (await client.get(f"/api/v1/jobs/{failed['id']}")).json()
    assert result["status"] == "failed" and result["error"]["message"] == "Image generation failed"
    app.state.image_jobs.generate.side_effect = None
    app.state.image_jobs.generate.return_value = b"invalid PNG"
    invalid = await create(client)
    await app.state.image_jobs.process(invalid["id"])
    assert (await client.get(f"/api/v1/jobs/{invalid['id']}")).json()["status"] == "failed"
    assert await app.state.library_service.repository.list_ready() == []


async def test_chat_results_stay_hidden_and_cross_project_edit_is_rejected(images):
    app, client = images
    project = await app.state.project_service.create_project(ProjectCreate())
    job = await app.state.job_service.create_chat_image(
        project.id, str(uuid4()), {"prompt": "A chair"}, "chat-1"
    )
    await app.state.image_jobs.process(job.id)
    attachment = await app.state.job_service.chat_image(job.id)
    result = (await client.get(f"/api/v1/jobs/{job.id}")).json()
    assert result["assets"][0]["status"] == "pending"
    assert result["assets"][0]["download_url"] == f"/api/v1/jobs/{job.id}/image"
    assert await app.state.library_service.repository.list_ready() == []
    assert (await client.get(f"/api/v1/jobs/{job.id}/image")).content == png()
    other = await app.state.project_service.create_project(ProjectCreate())
    with pytest.raises(ValueError, match="not available in this project"):
        await app.state.job_service.create_chat_image(
            other.id,
            str(uuid4()),
            {"prompt": "Make it blue", "source_attachment_id": attachment.id},
            "chat-2",
        )


async def test_painter_dispatch_import_replay_and_manifest_validation(images, tmp_path):
    app, client = images
    jobs = app.state.job_service
    jobs.image_settings = {
        "provider": "painter",
        "model": PAINTER_MODEL,
        "revision": PAINTER_REVISION,
        "width": 1024,
        "height": 1024,
        "steps": 4,
    }
    worker = app.state.image_jobs
    worker.queue = SimpleNamespace(publish=AsyncMock())
    worker.source = LocalLibraryStorage(tmp_path / "painter")
    job = await create(client)
    assert await worker.dispatch_next()
    assert not await worker.dispatch_next()
    request = worker.queue.publish.call_args.args[0]
    assert request.job_id == job["id"] and request.input.prompt == "A red chair"
    event = dict(schema_version=1, job_id=job["id"])
    await worker.register(GenerationResult(**event, status="running"))
    assert (await jobs.get(job["id"])).status == "running"
    raw = png()
    image_path = f"{job['id']}/image.png"
    manifest = {
        **event,
        "input": request.input.model_dump(),
        "image_path": image_path,
        "size_bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
    }
    worker.source.write_object(image_path, io.BytesIO(raw))
    result_path = f"{job['id']}/result.json"
    success = GenerationResult(**event, status="succeeded", result_path=result_path)
    manifest["sha256"] = "0" * 64
    worker.source.write_object(result_path, io.BytesIO(json.dumps(manifest).encode()))
    with pytest.raises(LibraryError, match="invalid_image_result"):
        await worker.register(success)
    assert (await jobs.get(job["id"])).status == "running"
    manifest["sha256"] = hashlib.sha256(raw).hexdigest()
    worker.source.write_object(result_path, io.BytesIO(json.dumps(manifest).encode()), replace=True)
    await worker.register(success)
    await worker.register(success)
    worker.generate.assert_not_awaited()
    assert (await jobs.get(job["id"])).status == "succeeded"
    assert len(await app.state.library_service.repository.list_ready()) == 1


@pytest.mark.parametrize(
    "parameters",
    [
        {"prompt": " "},
        {"prompt": "chair", "model": "untrusted"},
        {"prompt": "chair", "image_asset_id": "not-an-id"},
        {"prompt": "x" * 16001},
    ],
)
async def test_server_owns_image_input_schema(images, parameters):
    _, client = images
    response = await client.post(
        "/api/v1/jobs", json={"type": "image_generation", "input": parameters}
    )
    assert response.status_code == 422
    assert (await client.get("/api/v1/jobs")).json() == []
