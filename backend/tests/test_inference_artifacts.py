"""Artifact integrity, attempt scoping and atomic publication in local storage."""

import hashlib
import os
import time
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from PIL import Image
from sqlalchemy import select
from starlette.datastructures import URL

from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.persistence.enums import JobStatus
from camera_path.persistence.inference_attempt import InferenceAttemptRecord
from camera_path.persistence.inference_upload import InferenceUploadRecord
from camera_path.persistence.records import JobRecord, LibraryAssetRecord
from camera_path.repositories.library import LibraryRepository
from camera_path.repositories.project import ProjectRepository
from camera_path.services.inference_artifacts import (
    CompleteRequest,
    InferenceArtifacts,
    UploadRequest,
    staging_key,
)
from camera_path.services.library import LibraryService
from camera_path.services.library_metadata import LibraryError

PLY = b"ply\nformat ascii 1.0\nend_header\n"


class Request:
    headers = {}

    def __init__(self, data=b""):
        self.data = data

    def url_for(self, route, **params):
        assert route == "put_inference_upload"
        return URL(f"http://test/jobs/{params['job_id']}/uploads/{params['upload_id']}")

    async def stream(self):
        yield self.data[:3]
        yield self.data[3:]


@pytest.fixture
async def setup(tmp_path):
    repository = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite'}")
    await repository.initialize()
    sessions = repository.session_factory
    storage = LocalLibraryStorage(tmp_path / "library")
    service = InferenceArtifacts(
        SimpleNamespace(
            library=LibraryService(LibraryRepository(sessions), storage), sessions=sessions
        ),
        default_rotation_deg=(10, 20, 30),
    )
    yield service, sessions, storage
    await repository.close()


async def seed(sessions, kind):
    job_id, attempt_id, worker_id = (str(uuid4()) for _ in range(3))
    async with sessions.begin() as session:
        session.add(
            JobRecord(
                id=job_id,
                type=kind,
                input={"prompt": "A test shape"},
                execution={"transport": "cli"},
                status=JobStatus.RUNNING,
            )
        )
        await session.flush()
        session.add(
            InferenceAttemptRecord(
                id=attempt_id,
                job_id=job_id,
                claim_id=str(uuid4()),
                worker_id=worker_id,
                lease_expires_at=time.time() + 300,
                state="active",
                ordinal=1,
            )
        )

    async def guard(session):
        attempt = await session.get(InferenceAttemptRecord, attempt_id)
        if attempt.state != "active":
            raise LibraryError("inference_attempt_conflict", 409)
        return await session.get(JobRecord, job_id)

    async def finalize(session, job, receipt):
        attempt = await session.get(InferenceAttemptRecord, attempt_id)
        assert attempt.state == "active"
        assert job.status == "succeeded"
        attempt.state = "succeeded"
        attempt.terminal_result = receipt

    return job_id, attempt_id, guard, finalize


async def reserve(service, sessions, job, attempt, fmt, data):
    manifest = UploadRequest(
        attempt_id=attempt,
        files=[
            {
                "file_id": "main",
                "format": fmt,
                "size_bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        ],
    )
    async with sessions.begin() as session:
        return (await service.reserve(session, job, manifest, Request())).files[0]


@pytest.mark.parametrize("mode", ["model", "image"])
async def test_attempt_packet_validation_fencing_and_recovery(setup, mode):
    service, sessions, storage = setup
    if mode == "image":
        image = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        image.putpixel((0, 0), (255, 0, 0, 255))
        stream = BytesIO()
        image.save(stream, format="PNG")
        data, fmt, kind = stream.getvalue(), "png", "image_generation"
    else:
        data, fmt, kind = PLY, "ply", "generation"
    job, attempt, guard, finalize = await seed(sessions, kind)
    first = await reserve(service, sessions, job, attempt, fmt, data)
    retry = await reserve(service, sessions, job, attempt, fmt, data)
    assert retry.upload_id == first.upload_id
    assert retry.headers == {"Content-Length": str(len(data))}
    assert f"attempt_id={attempt}" in first.upload_url

    with pytest.raises(LibraryError) as bad:
        await service.put(job, retry.upload_id, attempt, Request(data[:-1] + b"X"), guard)
    assert bad.value.status == 422
    await service.put(job, retry.upload_id, attempt, Request(data), guard)

    if mode == "model":
        payload = CompleteRequest(
            attempt_id=attempt,
            assets=[
                {
                    "name": "Tree",
                    "bbox": {"min": [0, 0, 0], "max": [1, 2, 3]},
                    "primary_upload_id": retry.upload_id,
                    "upload_ids": [retry.upload_id],
                }
            ],
        )
    else:
        payload = CompleteRequest(attempt_id=attempt, image_upload_id=retry.upload_id)

    # The second guard runs after writing a final key but before SQL publication.
    calls = 0

    async def stale_guard(session):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise LibraryError("inference_attempt_conflict", 409)
        return await guard(session)

    with pytest.raises(LibraryError) as stale:
        await service.complete(job, payload, stale_guard, finalize)
    assert stale.value.status == 409
    assert not list(storage.directory.glob(f"*.{fmt}"))
    async with sessions() as session:
        assert not list(await session.scalars(select(LibraryAssetRecord)))

    result = await service.complete(job, payload, guard, finalize)
    assert result["status"] == "succeeded" and len(result["asset_ids"]) == 1
    async with sessions.begin() as session:
        saved = await session.get(InferenceAttemptRecord, attempt)
        assert saved.terminal_result == result
        asset = await session.get(LibraryAssetRecord, result["asset_ids"][0])
        upload = await session.get(InferenceUploadRecord, retry.upload_id)
        assert asset.object_key != staging_key(upload)
        assert storage.path(asset.object_key).read_bytes() == data
        if mode == "model":
            assert asset.default_rotation_y_deg == 20 and asset.bbox["max"] == [1, 2, 3]
        saved.lease_expires_at = time.time() - 7200

    await service.recover()
    assert not storage.path(staging_key(upload)).exists()
    assert storage.path(asset.object_key).read_bytes() == data


async def test_upload_identifier_cannot_be_reused_by_another_attempt(setup):
    service, sessions, _ = setup
    first_job, first_attempt, _, _ = await seed(sessions, "generation")
    second_job, second_attempt, guard, _ = await seed(sessions, "generation")
    pending = await reserve(service, sessions, first_job, first_attempt, "ply", PLY)
    with pytest.raises(LibraryError) as forbidden:
        await service.put(second_job, pending.upload_id, second_attempt, Request(PLY), guard)
    assert forbidden.value.status == 404


async def test_corrupt_png_with_matching_checksum_keeps_attempt_active(setup):
    service, sessions, storage = setup
    job, attempt, guard, finalize = await seed(sessions, "image_generation")
    data = b"\x89PNGinvalid"
    pending = await reserve(service, sessions, job, attempt, "png", data)
    await service.put(job, pending.upload_id, attempt, Request(data), guard)
    payload = CompleteRequest(attempt_id=attempt, image_upload_id=pending.upload_id)
    with pytest.raises(LibraryError) as invalid:
        await service.complete(job, payload, guard, finalize)
    assert invalid.value.status == 422
    assert not list(storage.directory.glob("*.png"))
    async with sessions() as session:
        assert (await session.get(InferenceAttemptRecord, attempt)).state == "active"


async def test_old_staging_survives_active_attempt_but_not_deleted_job(setup):
    service, sessions, storage = setup
    job, attempt, guard, _ = await seed(sessions, "generation")
    pending = await reserve(service, sessions, job, attempt, "ply", PLY)
    await service.put(job, pending.upload_id, attempt, Request(PLY), guard)
    async with sessions() as session:
        row = await session.get(InferenceUploadRecord, pending.upload_id)
        path = storage.path(staging_key(row))
    old = time.time() - 7200
    os.utime(path, (old, old))
    await service.recover()
    assert path.exists()
    async with sessions.begin() as session:
        await session.delete(await session.get(JobRecord, job))
    await service.recover()
    assert not path.exists()
