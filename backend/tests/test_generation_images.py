"""Image lifecycle through the real API and the generation/import contracts."""

import hashlib
import io
import json
from uuid import uuid4

import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient
from PIL import Image

from camera_path.config import Settings
from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.services.generation_integration import GenerationIntegration
from camera_path.services.generation_models import GenerationResult
from camera_path.services.job_completion import JobCompletionService
from camera_path.services.library_metadata import LibraryError


class Queue:
    def __init__(self):
        self.requests = []

    async def publish(self, request):
        self.requests.append(request.model_dump())


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
    app.state.job_service.generation_enabled = True
    output = LocalLibraryStorage(tmp_path / "generation")
    queue = Queue()
    integration = GenerationIntegration(
        queue,
        JobCompletionService(app.state.library_service, {"generation": output}),
        output,
        default_rotation_deg=(180, 0, 0),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield app, client, integration, queue, output
    await app.state.project_repository.close()


async def upload(client, data, fmt="png"):
    response = await client.post(
        "/api/v1/library/uploads",
        json={
            "name": f"Original.{fmt}",
            "format": fmt,
            "size_bytes": len(data),
        },
    )
    assert response.status_code == 201
    pending = response.json()
    assert (await client.put(pending["upload_url"], content=data)).status_code == 204
    return await client.post(f"/api/v1/library/{pending['id']}/complete")


def picture(fmt="PNG"):
    stream = io.BytesIO()
    Image.new("RGB", (12, 15), "red").save(stream, format=fmt)
    return stream.getvalue()


@pytest.mark.parametrize(
    "fmt,pil_fmt,mime",
    [
        ("png", "PNG", "image/png"),
        ("jpg", "JPEG", "image/jpeg"),
        ("jpeg", "JPEG", "image/jpeg"),
        ("webp", "WEBP", "image/webp"),
    ],
)
async def test_original_images_are_validated_and_served_without_rewriting(
    images, fmt, pil_fmt, mime
):
    _, client, *_ = images
    data = picture(pil_fmt)
    response = await upload(client, data, fmt)
    assert response.status_code == 200
    asset = response.json()
    content = await client.get(asset["thumbnail_url"])
    assert content.content == data and content.headers["content-type"] == mime
    assert (await client.get(asset["download_url"])).content == data
    assert (await upload(client, data[:16], fmt)).status_code == 422
    assert (await upload(client, b"RIFFthis is not a WebP", "webp")).status_code == 422


async def test_image_job_locks_input_dispatches_a_path_imports_output_and_preserves_history(images):
    _, client, integration, queue, output = images
    original = picture()
    image = (await upload(client, original)).json()
    response = await client.post(
        "/api/v1/jobs",
        json={
            "type": "generation",
            "input": {"image_asset_id": image["id"]},
            "start": True,
        },
    )
    assert response.status_code == 201
    job = response.json()
    assert job["input"] == {"image_asset_id": image["id"]}
    assert job["input_asset"]["id"] == image["id"] and job["assets"] == []
    assert (await client.delete(f"/api/v1/library/{image['id']}")).status_code == 409
    other = (await upload(client, original, "png")).json()
    assert (
        await client.post(
            "/api/v1/library/bulk-delete",
            json={
                "asset_ids": [other["id"], image["id"]],
            },
        )
    ).status_code == 409
    assert (await client.get(other["download_url"])).content == original

    assert await integration._dispatch_next()
    wire_input = queue.requests[0]["input"]
    assert "image_asset_id" not in wire_input
    assert wire_input["image_sha256"] == hashlib.sha256(original).hexdigest()
    assert output.path(f"inputs/{job['id']}/{image['id']}.png").read_bytes() == original
    assert wire_input["image_path"].endswith(f"/{image['id']}.png")
    # Replaying durable dispatch uses the same bytes/path and cannot double-import outputs.
    assert not await integration._dispatch_next()
    path = output.path(f"{job['id']}/result.json")
    path.parent.mkdir()
    (path.parent / "asset.ply").write_bytes(b"ply\nformat ascii 1.0\nend_header\n")
    manifest = {
        "schema_version": 1,
        "job_id": job["id"],
        "input": wire_input,
        "files": [f"{job['id']}/asset.ply"],
        "bbox": {"min": [0, 0, 0], "max": [1, 1, 1]},
    }
    result = GenerationResult(
        schema_version=1,
        job_id=job["id"],
        status="succeeded",
        result_path=f"{job['id']}/result.json",
    )
    path.write_text(json.dumps({**manifest, "input": {**wire_input, "image_sha256": "0" * 64}}))
    with pytest.raises(LibraryError, match="invalid_generation_result"):
        await integration.register(result)
    path.write_text(json.dumps(manifest))
    await integration.register(result)
    await integration.register(result)
    finished = (await client.get(f"/api/v1/jobs/{job['id']}")).json()
    assert finished["status"] == "succeeded" and len(finished["assets"]) == 1
    assert finished["input_asset"]["id"] == image["id"]
    assert finished["assets"][0]["default_rotation_deg"] == [180, 0, 0]
    assert finished["assets"][0]["name"] == image["name"]
    assert (await client.delete(f"/api/v1/library/{image['id']}")).status_code == 204
    history = (await client.get(f"/api/v1/jobs/{job['id']}")).json()
    assert history["input_asset"] is None and history["input"] == job["input"]
    assert len(history["assets"]) == 1


async def test_failed_job_releases_image_and_invalid_image_references_are_rejected(images):
    _, client, integration, *_ = images
    image = (await upload(client, picture())).json()
    for parameters in (
        {"image_asset_id": str(uuid4())},
        {"image_asset_id": "invalid"},
        {"image_asset_id": image["id"], "prompt": "Both"},
        {"image_path": "/etc/passwd"},
    ):
        assert (
            await client.post(
                "/api/v1/jobs",
                json={
                    "type": "generation",
                    "input": parameters,
                    "start": True,
                },
            )
        ).status_code == 422
    job = (
        await client.post(
            "/api/v1/jobs",
            json={
                "type": "generation",
                "input": {"image_asset_id": image["id"]},
                "start": True,
            },
        )
    ).json()
    await integration.register(
        GenerationResult(
            schema_version=1,
            job_id=job["id"],
            status="failed",
            error={"code": "generation_failed", "message": "Trellis generation failed."},
        )
    )
    assert (await client.delete(f"/api/v1/library/{image['id']}")).status_code == 204


async def test_image_is_locked_until_all_consumers_finish_and_cannot_be_placed_in_scene(images):
    _, client, integration, *_ = images
    image = (await upload(client, picture())).json()
    jobs = [
        (
            await client.post(
                "/api/v1/jobs",
                json={
                    "type": "generation",
                    "input": {"image_asset_id": image["id"]},
                    "start": True,
                },
            )
        ).json()
        for _ in range(2)
    ]
    for index, job in enumerate(jobs):
        await integration.register(
            GenerationResult(
                schema_version=1,
                job_id=job["id"],
                status="failed",
                error={"code": "generation_failed", "message": "Trellis generation failed."},
            )
        )
        if index == 0:
            assert (await client.delete(f"/api/v1/library/{image['id']}")).status_code == 409
    project = (await client.post("/api/v1/projects", json={"name": "Image guard"})).json()["id"]
    project_url = f"/api/v1/projects/{project}"
    etag = (await client.get(project_url)).headers["etag"]
    rejected = await client.post(
        project_url + "/scene-objects",
        json={
            "library_asset_id": image["id"],
        },
        headers={"If-Match": etag},
    )
    assert rejected.status_code == 422
    assert (await client.get(project_url)).headers["etag"] == etag
    assert (await client.get(project_url + "/scene-objects")).json() == []
    assert (await client.delete(f"/api/v1/library/{image['id']}")).status_code == 204
