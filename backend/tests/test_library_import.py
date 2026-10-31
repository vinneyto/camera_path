import asyncio
import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.config import Settings
from camera_path.dev.records import DevQueueMessageRecord
from camera_path.persistence.records import LibraryAssetFileRecord
from camera_path.services.library_import_models import LibraryImportMessage

PLY = b"ply\nformat ascii 1.0\nend_header\n"
SOG = b"PK\x03\x04fixture"


@pytest.fixture
async def setup(tmp_path):
    app = create_editor_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "library",
            message_queue="dev",
            library_import_sources={
                "incoming": {"driver": "local", "root": str(tmp_path / "incoming")}
            },
        )
    )
    await app.state.project_repository.initialize()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield app, client, tmp_path
    await app.state.project_repository.close()


def message(root, files=("sog", "ply"), storage="incoming"):
    result = {
        "schema_version": 1,
        "message_id": str(uuid4()),
        "item": {
            "client_id": str(uuid4()),
            "name": " Tree ",
            "tags": [" tree ", "TREE", "Rock"],
            "primary_file_id": files[0],
            "files": [],
        },
    }
    for fmt in files:
        content = PLY if fmt == "ply" else SOG
        path = root / storage / f"tree.{fmt}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        result["item"]["files"].append(
            {
                "id": fmt,
                "format": fmt,
                "size_bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "source": {"storage": storage, "path": path.name},
            }
        )
    return result


async def process(app, payload):
    queue = app.state.message_queue
    await queue.enqueue(LibraryImportMessage.model_validate(payload))
    delivery = await queue.receive()
    assert delivery is not None
    await app.state.library_import_consumer.process(delivery)
    return await queue.status(payload["message_id"])


async def test_multiple_files_copy_primary_replay_delete_and_tombstone(setup):
    app, client, root = setup
    payload = message(root)
    status = await process(app, payload)
    assert status.status == "succeeded"
    asset = (await client.get(f"/api/v1/library/{status.asset_id}")).json()
    assert asset["name"] == "Tree" and asset["tags"] == ["tree", "Rock"]
    assert asset["primary_file_id"] == "sog" and asset["format"] == "sog"
    assert asset["size_bytes"] == len(SOG)
    assert (await client.get(asset["download_url"])).content == SOG
    assert [f["id"] for f in asset["files"]] == ["sog", "ply"]
    for file in asset["files"]:
        assert (await client.get(file["download_url"])).content == (
            SOG if file["id"] == "sog" else PLY
        )
    record = await app.state.library_service.repository.get(asset["id"])
    copied_keys = [f.object_key for f in record.files]
    for key in copied_keys:
        assert key not in {"tree.ply", "tree.sog"}
        assert len(key.split(".")[0]) == 36
    assert sorted(p.name for p in (root / "incoming").iterdir()) == ["tree.ply", "tree.sog"]
    # A committed replay no longer needs the producer's copies or the original source alias.
    for p in (root / "incoming").iterdir():
        p.unlink()
    replay = copy.deepcopy(payload)
    replay["message_id"] = str(uuid4())
    assert (await process(app, replay)).asset_id == asset["id"]
    assert len((await client.get("/api/v1/library")).json()) == 1
    replay["message_id"] = str(uuid4())
    replay["item"]["files"][0]["sha256"] = "0" * 64
    assert (await process(app, replay)).error_code == "library_client_id_conflict"
    assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 204
    assert all(not (root / "library" / key).exists() for key in copied_keys)
    payload["message_id"] = str(uuid4())
    assert (await process(app, payload)).error_code == "library_client_id_deleted"


async def test_existing_library_files_are_adopted_with_original_keys(setup):
    app, client, root = setup
    payload = message(root, storage="library")
    # A second alias of the destination resolves to the same objects, still without copies.
    app.state.library_import_service.sources["incoming"] = app.state.library_service.storage
    payload["item"]["files"][1]["source"]["storage"] = "incoming"
    result = await process(app, payload)
    record = await app.state.library_service.repository.get(result.asset_id)
    assert [f.object_key for f in record.files] == ["tree.sog", "tree.ply"]
    assert set(p.name for p in (root / "library").iterdir()) <= {"tree.ply", "tree.sog", "_imports"}
    other = copy.deepcopy(payload)
    other["message_id"], other["item"]["client_id"] = str(uuid4()), str(uuid4())
    assert (await process(app, other)).error_code == "library_import_object_conflict"
    assert (root / "library/tree.sog").read_bytes() == SOG


@pytest.mark.parametrize("bad", ["hash", "size", "signature", "missing", "alias"])
async def test_failure_does_not_publish_partial_items_or_leave_copies(setup, bad):
    app, client, root = setup
    payload = message(root)
    file = payload["item"]["files"][1]
    if bad == "hash":
        file["sha256"] = "0" * 64
    elif bad == "size":
        file["size_bytes"] += 1
    elif bad == "signature":
        contents = b"bad\n" + PLY[4:]
        (root / "incoming/tree.ply").write_bytes(contents)
        file["sha256"] = hashlib.sha256(contents).hexdigest()
    elif bad == "missing":
        (root / "incoming/tree.ply").unlink()
    else:
        file["source"]["storage"] = "unknown"
    assert (await process(app, payload)).status == "failed"
    assert (await client.get("/api/v1/library")).json() == []
    assert not list((root / "library").glob("*.sog"))
    assert not list((root / "library/_imports").glob("*.json"))
    assert (root / "incoming/tree.sog").read_bytes() == SOG


async def test_thumbnails_and_source_namespace_validation(setup):
    app, client, root = setup
    payload = message(root, ("ply",))
    key = f"thumbnails/{payload['item']['client_id']}/tree.png"
    image = root / "library" / key
    image.parent.mkdir(parents=True)
    image.write_bytes(b"\x89PNG\r\n\x1a\nfixture")
    payload["item"]["thumbnail_key"] = key
    result = await process(app, payload)
    asset = (await client.get(f"/api/v1/library/{result.asset_id}")).json()
    response = await client.get(asset["thumbnail_url"])
    assert (
        response.content == image.read_bytes() and response.headers["content-type"] == "image/png"
    )
    assert len(asset["files"]) == 1
    assert (await client.delete(f"/api/v1/library/{result.asset_id}")).status_code == 204
    assert not image.exists()


async def test_symlink_escape_is_rejected_without_touching_target(setup):
    app, client, root = setup
    payload = message(root, ("ply",))
    target = root / "outside.ply"
    target.write_bytes(PLY)
    source = root / "incoming/tree.ply"
    source.unlink()
    source.symlink_to(target)
    assert (await process(app, payload)).error_code == "library_import_invalid_source"
    assert target.read_bytes() == PLY
    assert (await client.get("/api/v1/library")).json() == []


async def test_duplicate_objects_through_aliases_are_rejected(setup):
    app, _, root = setup
    payload = message(root, ("ply",))
    duplicate = copy.deepcopy(payload["item"]["files"][0])
    duplicate["id"] = "other"
    duplicate["source"]["storage"] = "second"
    payload["item"]["files"].append(duplicate)
    app.state.library_import_service.sources["second"] = app.state.library_import_service.sources[
        "incoming"
    ]
    assert (await process(app, payload)).error_code == "library_import_invalid_source"


async def test_concurrent_equal_imports_converge_and_delete_rollback_restores_all(
    setup, monkeypatch
):
    app, client, root = setup
    payload = LibraryImportMessage.model_validate(message(root))
    importer = app.state.library_import_service
    first, second = await asyncio.gather(importer.register(payload), importer.register(payload))
    assert first == second
    assert len(list((root / "library").glob("*.sog"))) == 1
    original = AsyncSession.commit

    async def fail_commit(self):
        raise RuntimeError("SQL failed")

    monkeypatch.setattr(AsyncSession, "commit", fail_commit)
    with pytest.raises(RuntimeError):
        await client.delete(f"/api/v1/library/{first}")
    monkeypatch.setattr(AsyncSession, "commit", original)
    asset = (await client.get(f"/api/v1/library/{first}")).json()
    for file in asset["files"]:
        assert (await client.get(file["download_url"])).status_code == 200


async def test_dev_http_durability_idempotence_and_lease_cas(setup):
    app, client, root = setup
    payload = message(root)
    accepted = await client.post(
        "/api/v1/dev/library-imports",
        content=json.dumps(payload),
        headers={"Content-Type": "application/json"},
    )
    assert accepted.status_code == 202
    queue = app.state.message_queue
    assert (await queue.status(payload["message_id"])).status == "queued"
    assert (await client.post("/api/v1/dev/library-imports", json=payload)).status_code == 202
    conflict = copy.deepcopy(payload)
    conflict["item"]["name"] = "Different"
    assert (await client.post("/api/v1/dev/library-imports", json=conflict)).status_code == 409
    first = await queue.receive()
    async with queue.sessions.begin() as session:
        await session.execute(
            update(DevQueueMessageRecord).values(
                lease_until=datetime.now(UTC) - timedelta(seconds=1)
            )
        )
    # Reopening the queue against the same DB must recover an expired delivery.
    from camera_path.dev.message_queue import DevMessageQueue

    reopened = DevMessageQueue(queue.sessions)
    second = await reopened.receive()
    assert second.attempts == 2 and second.receipt != first.receipt
    await queue.ack(first.receipt, "wrong")
    assert (await queue.status(payload["message_id"])).status == "processing"
    await app.state.library_import_consumer.process(second)
    assert (await queue.status(payload["message_id"])).status == "succeeded"
    assert (
        await client.post("/api/v1/dev/library-imports", content=b" " * (256 * 1024 + 1))
    ).status_code == 413
    bad = copy.deepcopy(payload)
    bad["schema_version"] = True
    assert (await client.post("/api/v1/dev/library-imports", json=bad)).status_code == 422
    assert (await client.get("/api/v1/dev/library-imports/not-a-uuid")).status_code == 422


async def test_post_commit_ack_loss_redelivers_without_duplicate(setup, monkeypatch):
    app, _, root = setup
    queue = app.state.message_queue
    payload = LibraryImportMessage.model_validate(message(root))
    await queue.enqueue(payload)
    delivery = await queue.receive()
    original = queue.ack

    async def fail_ack(*args):
        raise OSError("Queue unavailable after commit")

    monkeypatch.setattr(queue, "ack", fail_ack)
    with pytest.raises(OSError):
        await app.state.library_import_consumer.process(delivery)
    async with queue.sessions.begin() as session:
        await session.execute(
            update(DevQueueMessageRecord).values(
                lease_until=datetime.now(UTC) - timedelta(seconds=1)
            )
        )
    monkeypatch.setattr(queue, "ack", original)
    await app.state.library_import_consumer.process(await queue.receive())
    assert (await queue.status(payload.message_id)).status == "succeeded"
    assert len(await app.state.library_service.repository.list_ready()) == 1


async def test_expired_attempt_recovery_removes_only_uncommitted_copies(setup):
    app, _, root = setup
    payload = message(root)
    ready = await process(app, payload)
    record = await app.state.library_service.repository.get(ready.asset_id)
    orphan = root / "library" / f"{uuid4()}.ply"
    marker = root / "library/_imports/abandoned.json"
    import io

    app.state.library_service.storage.write_import_object(
        orphan.name, io.BytesIO(PLY), "_imports/abandoned.json"
    )
    marker.write_text(json.dumps({"keys": [orphan.name, record.object_key], "expires_at": 0}))
    await app.state.library_import_service.recover()
    assert not orphan.exists() and not marker.exists()
    assert (root / "library" / record.object_key).exists()
    async with app.state.project_repository.session_factory() as session:
        assert len((await session.scalars(select(LibraryAssetFileRecord))).all()) == 2


async def test_sql_failure_after_copies_is_retried_without_partial_publication(setup, monkeypatch):
    app, client, root = setup
    payload = message(root)
    queue = app.state.message_queue
    await queue.enqueue(LibraryImportMessage.model_validate(payload))
    original = AsyncSession.flush

    async def fail_library_insert(self, *args, **kwargs):
        if any(type(row).__name__ == "LibraryAssetRecord" for row in self.new):
            raise RuntimeError("Simulated SQL failure after copy")
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(AsyncSession, "flush", fail_library_insert)
    await app.state.library_import_consumer.process(await queue.receive())
    assert (await queue.status(payload["message_id"])).status == "queued"
    assert (await client.get("/api/v1/library")).json() == []
    assert not list((root / "library").glob("*.sog"))
    monkeypatch.setattr(AsyncSession, "flush", original)
    async with queue.sessions.begin() as session:
        await session.execute(update(DevQueueMessageRecord).values(available_at=datetime.now(UTC)))
    await app.state.library_import_consumer.process(await queue.receive())
    assert (await queue.status(payload["message_id"])).status == "succeeded"


async def test_exhausted_temporary_failure_is_durable(setup, monkeypatch):
    app, _, root = setup
    app.state.library_import_consumer.max_attempts = 1

    async def unavailable(message):
        raise OSError("Unavailable source provider")

    monkeypatch.setattr(app.state.library_import_service, "register", unavailable)
    status = await process(app, message(root))
    assert status.status == "failed" and status.error_code == "library_import_unavailable"


async def test_manual_upload_client_id_replay_tags_and_lookup(setup):
    app, client, root = setup
    client_id = str(uuid4())
    data = {
        "name": " Manual ",
        "size_bytes": len(PLY),
        "client_id": client_id.upper(),
        "tags": [" Tree ", "tree", "ROCK"],
    }
    first = await client.post("/api/v1/library/uploads", json=data)
    assert first.status_code == 201
    asset = first.json()
    retry = await client.post("/api/v1/library/uploads", json={**data, "tags": ["rock", "TREE"]})
    assert retry.status_code == 200 and retry.json()["id"] == asset["id"]
    assert retry.json()["tags"] == ["Tree", "ROCK"]
    assert asset["client_id"] == client_id and asset["primary_file_id"] == "main"
    assert (await client.get(f"/api/v1/library/by-client-id/{client_id}")).status_code == 404
    assert (await client.put(asset["upload_url"], content=PLY)).status_code == 204
    assert (await client.post(f"/api/v1/library/{asset['id']}/complete")).status_code == 200
    assert (await client.get(f"/api/v1/library/by-client-id/{client_id}")).json()["id"] == asset[
        "id"
    ]
    ready_retry = await client.post("/api/v1/library/uploads", json=data)
    assert ready_retry.status_code == 200 and ready_retry.json()["upload_url"] is None
    assert (
        await client.post("/api/v1/library/uploads", json={**data, "name": "Other"})
    ).status_code == 409
    assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 204
    assert (await client.post("/api/v1/library/uploads", json=data)).json()[
        "code"
    ] == "library_client_id_deleted"


@pytest.mark.parametrize(
    "mutation",
    [
        {"client_id": "not a uuid"},
        {"client_id": "00000000-0000-0000-0000-000000000000"},
        {"tags": None},
        {"tags": [""]},
        {"tags": ["bad\nvalue"]},
        {"tags": ["x"] * 21},
        {"thumbnail_key": "thumbnails/foreign/image.png"},
    ],
)
async def test_manual_metadata_validation_is_atomic(setup, mutation):
    _, client, _ = setup
    response = await client.post(
        "/api/v1/library/uploads",
        json={
            "name": "Cloud",
            "size_bytes": 4,
            **mutation,
        },
    )
    assert response.status_code == 422
    assert (await client.get("/api/v1/library")).json() == []


@pytest.mark.parametrize(
    "kwargs",
    [
        {"message_queue": "dev", "environment": "production", "auth_email_delivery": "ses"},
        {"message_queue": "sqs"},
        {"message_queue_lease_seconds": 0},
        {"library_import_sources": {"library": {"driver": "local", "root": "/tmp"}}},
        {"library_import_sources": {"incoming": {"driver": "s3", "bucket": "b", "prefix": "../"}}},
        {"library_import_sources": {"incoming": {"driver": "unknown"}}},
    ],
)
def test_invalid_queue_configuration_fails_fast(kwargs):
    with pytest.raises(ValueError):
        Settings(_env_file=None, **kwargs)


async def test_s3_destination_uses_the_same_import_handler_with_verified_bytes(setup):
    import io

    from botocore.exceptions import ClientError

    from camera_path.aws.library_storage import S3LibraryStorage
    from camera_path.services.library import LibraryService
    from camera_path.services.library_import import LibraryImportService

    class MemoryS3:
        def __init__(self):
            self.objects = {}
            self.metadata = {}

        def put_object(self, **kwargs):
            key = kwargs["Key"]
            assert kwargs["Bucket"] == "test-library"
            if kwargs.get("IfNoneMatch") == "*" and key in self.objects:
                raise AssertionError("Attempted overwrite")
            self.objects[key] = kwargs["Body"].read()
            self.metadata[key] = kwargs.get("Metadata", {})

        def head_object(self, **kwargs):
            if kwargs["Key"] not in self.objects:
                raise ClientError({"Error": {"Code": "NoSuchKey"}}, "HeadObject")
            return {"Metadata": self.metadata.get(kwargs["Key"], {})}

        def get_object(self, **kwargs):
            if kwargs["Key"] not in self.objects:
                raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
            return {"Body": io.BytesIO(self.objects[kwargs["Key"]])}

        def delete_object(self, **kwargs):
            self.objects.pop(kwargs["Key"], None)

    app, _, root = setup
    client = MemoryS3()
    store = S3LibraryStorage(client, "test-library")
    library = LibraryService(app.state.library_service.repository, store)
    importer = LibraryImportService(library, app.state.library_import_service.sources)
    payload = message(root)
    payload["item"]["files"][0]["source"] = {"storage": "library", "path": "tree.sog"}
    client.objects["library/tree.sog"] = SOG
    asset_id = await importer.register(LibraryImportMessage.model_validate(payload))
    record = await library.repository.get(asset_id)
    assert record.files[0].object_key == "tree.sog"
    assert client.objects["library/tree.sog"] == SOG
    assert client.objects["library/" + record.files[1].object_key] == PLY
    assert not any("_imports/" in key for key in client.objects)
    assert record.files[1].sha256 == hashlib.sha256(PLY).hexdigest()


async def test_uuid_collision_never_overwrites_or_cleans_up_foreign_bytes(setup, monkeypatch):
    from uuid import UUID

    import camera_path.services.library_import as module

    app, client, root = setup
    payload = message(root, ("ply",))
    fixed = UUID("cb53b5cf-e3e1-4c11-894b-3438855463e8")
    foreign = root / "library" / f"{fixed}.ply"
    foreign.write_bytes(b"producer-owned bytes")
    monkeypatch.setattr(module, "uuid4", lambda: fixed)
    result = await process(app, payload)
    assert result.status == "failed" and result.error_code == "library_import_object_conflict"
    assert foreign.read_bytes() == b"producer-owned bytes"
    assert (await client.get("/api/v1/library")).json() == []
    assert not list((root / "library/_imports").glob("*.json"))


async def test_dev_validation_errors_use_structured_fields(setup):
    _, client, _ = setup
    response = await client.post(
        "/api/v1/dev/library-imports", content=b"\xff", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422 and response.json()["field_errors"][0]["location"] == [
        "body"
    ]
    response = await client.get("/api/v1/library/by-client-id/invalid")
    assert response.status_code == 422
    assert response.json()["field_errors"][0]["location"] == ["path", "client_id"]


async def test_long_import_refreshes_dev_delivery_lease(setup, monkeypatch):
    app, _, root = setup
    queue = app.state.message_queue
    queue.lease_seconds = 1
    consumer = app.state.library_import_consumer
    consumer.lease_seconds = 1
    original = app.state.library_import_service.register
    release = asyncio.Event()

    async def paused(message):
        await release.wait()
        return await original(message)

    monkeypatch.setattr(app.state.library_import_service, "register", paused)
    payload = LibraryImportMessage.model_validate(message(root, ("ply",)))
    await queue.enqueue(payload)
    work = asyncio.create_task(consumer.process(await queue.receive()))
    try:
        await asyncio.sleep(1.1)
        assert await queue.receive() is None
        release.set()
        await work
    finally:
        release.set()
        if not work.done():
            work.cancel()
            with pytest.raises(asyncio.CancelledError):
                await work
    assert (await queue.status(payload.message_id)).status == "succeeded"
