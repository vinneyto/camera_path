import io
from pathlib import Path
from unittest.mock import Mock
from urllib.parse import parse_qs, urlparse

import pytest
from conftest import create_editor_app
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.api import create_app
from camera_path.config import Settings
from camera_path.services.library_storage import LibraryStorageError

boto3 = pytest.importorskip("boto3")
from botocore.config import Config  # noqa: E402
from botocore.response import StreamingBody  # noqa: E402
from botocore.stub import ANY, Stubber  # noqa: E402

from camera_path.aws.library_storage import S3LibraryStorage  # noqa: E402

BUCKET = "test-library"
KEY = "asset.ply"
PENDING = f"library/_uploads/{KEY}"
READY = f"library/{KEY}"


@pytest.fixture
def storage():
    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
        config=Config(signature_version="s3v4"),
    )
    with Stubber(client) as stub:
        yield S3LibraryStorage(client, BUCKET), stub
        stub.assert_no_pending_responses()
    client.close()


def inspect_response(stub, key=PENDING, size=4, header=b"ply\n"):
    stub.add_response(
        "head_object",
        {"ContentLength": size, "ETag": '"etag"'},
        {"Bucket": BUCKET, "Key": key},
    )
    if size:
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(io.BytesIO(header), len(header))},
            {"Bucket": BUCKET, "Key": key, "Range": "bytes=0-3", "IfMatch": '"etag"'},
        )


def missing(stub, key):
    stub.add_client_error(
        "head_object",
        service_error_code="404",
        http_status_code=404,
        expected_params={"Bucket": BUCKET, "Key": key},
    )


def promoted(stub, pending=PENDING, ready=READY):
    stub.add_response(
        "copy_object",
        {"CopyObjectResult": {"ETag": '"etag"'}},
        {
            "Bucket": BUCKET,
            "Key": ready,
            "CopySource": {"Bucket": BUCKET, "Key": pending},
            "CopySourceIfMatch": '"etag"',
        },
    )
    stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": pending})


async def test_presigned_urls_are_private_expiring_and_use_separate_keys(storage):
    adapter, _ = storage
    upload = urlparse(await adapter.upload_url("asset", KEY, None))
    download = urlparse(await adapter.download_url("asset", KEY, None))
    assert upload.path.endswith("/library/_uploads/asset.ply")
    assert download.path.endswith("/library/asset.ply")
    for url in (upload, download):
        params = parse_qs(url.query)
        assert params["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
        assert params["X-Amz-Expires"] == ["300"]
        assert "X-Amz-Signature" in params
    assert parse_qs(download.query)["response-content-disposition"] == [
        'attachment; filename="asset.ply"'
    ]


@pytest.mark.parametrize("key", ["../foreign.ply", "other/key.ply", "", "..", "a\\b"])
async def test_foreign_keys_are_rejected(storage, key):
    adapter, _ = storage
    with pytest.raises(ValueError):
        await adapter.upload_url("asset", key, None)


async def test_valid_upload_promotes_only_the_inspected_object(storage):
    adapter, stub = storage
    inspect_response(stub)
    promoted(stub)
    assert await adapter.finalize_upload(KEY, 4)


@pytest.mark.parametrize("size,header", [(5, b"ply\n"), (4, b"nope"), (0, b"")])
async def test_invalid_upload_is_not_promoted(storage, size, header):
    adapter, stub = storage
    inspect_response(stub, size=size, header=header)
    assert not await adapter.finalize_upload(KEY, 4)


async def test_missing_upload_is_invalid_and_promoted_upload_can_recover(storage):
    adapter, stub = storage
    missing(stub, PENDING)
    missing(stub, READY)
    assert not await adapter.finalize_upload(KEY, 4)
    missing(stub, PENDING)
    inspect_response(stub, key=READY)
    assert await adapter.finalize_upload(KEY, 4)


async def test_changed_upload_etag_does_not_publish_an_unchecked_object(storage):
    adapter, stub = storage
    inspect_response(stub)
    stub.add_client_error(
        "copy_object",
        service_error_code="PreconditionFailed",
        http_status_code=412,
        expected_params={
            "Bucket": BUCKET,
            "Key": READY,
            "CopySource": {"Bucket": BUCKET, "Key": PENDING},
            "CopySourceIfMatch": '"etag"',
        },
    )
    with pytest.raises(LibraryStorageError):
        await adapter.finalize_upload(KEY, 4)


def deletion_staging(stub):
    stub.add_response(
        "head_object",
        {"ContentLength": 4, "ETag": '"etag"'},
        {"Bucket": BUCKET, "Key": READY},
    )
    stub.add_response(
        "copy_object",
        {},
        {
            "Bucket": BUCKET,
            "Key": ANY,
            "CopySource": {"Bucket": BUCKET, "Key": READY},
            "CopySourceIfMatch": '"etag"',
        },
    )
    stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": READY})
    missing(stub, PENDING)


async def test_sql_failure_restores_deleted_object(storage):
    adapter, stub = storage
    deletion_staging(stub)
    stub.add_response(
        "copy_object",
        {},
        {"Bucket": BUCKET, "Key": READY, "CopySource": {"Bucket": BUCKET, "Key": ANY}},
    )
    stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ANY})
    with pytest.raises(RuntimeError, match="SQL commit failed"):
        async with adapter.stage_delete([KEY]):
            raise RuntimeError("SQL commit failed")


async def test_successful_delete_cleans_backups_and_tolerates_missing_content(storage):
    adapter, stub = storage
    deletion_staging(stub)
    stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ANY})
    async with adapter.stage_delete([KEY]):
        pass
    missing(stub, READY)
    missing(stub, PENDING)
    async with adapter.stage_delete([KEY]):
        pass


async def test_failed_restore_retains_backup_for_manual_recovery(storage):
    adapter, stub = storage
    deletion_staging(stub)
    stub.add_client_error(
        "copy_object",
        service_error_code="AccessDenied",
        http_status_code=403,
        expected_params={
            "Bucket": BUCKET,
            "Key": READY,
            "CopySource": {"Bucket": BUCKET, "Key": ANY},
        },
    )
    with pytest.raises(LibraryStorageError):
        async with adapter.stage_delete([KEY]):
            raise RuntimeError("SQL commit failed")
    # The stub has no cleanup response: retained backup must not be deleted.


async def test_cleanup_failure_after_commit_does_not_report_failed_deletion(
    storage, caplog, monkeypatch
):
    # Alembic's logging setup in other tests disables pre-existing module loggers.
    from camera_path.aws.library_storage import logger

    monkeypatch.setattr(logger, "disabled", False)
    adapter, stub = storage
    deletion_staging(stub)
    stub.add_client_error(
        "delete_object",
        service_error_code="AccessDenied",
        http_status_code=403,
        expected_params={"Bucket": BUCKET, "Key": ANY},
    )
    async with adapter.stage_delete([KEY]):
        pass
    assert "backup cleanup failed" in caplog.text


async def test_partial_staging_failure_restores_before_returning_error(storage):
    adapter, stub = storage
    deletion_staging(stub)
    stub.add_client_error(
        "head_object",
        service_error_code="AccessDenied",
        http_status_code=403,
        expected_params={"Bucket": BUCKET, "Key": "library/second.ply"},
    )
    stub.add_response(
        "copy_object",
        {},
        {"Bucket": BUCKET, "Key": READY, "CopySource": {"Bucket": BUCKET, "Key": ANY}},
    )
    stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ANY})
    with pytest.raises(LibraryStorageError):
        async with adapter.stage_delete([KEY, "second.ply"]):
            pytest.fail("must not reach SQL mutation")


async def test_s3_api_auth_validation_restart_and_sql_recovery(storage, tmp_path, monkeypatch):
    adapter, stub = storage
    settings = Settings(
        _env_file=None, database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}"
    )
    app = create_editor_app(settings, library_storage=adapter)
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/v1/library/uploads", json={"name": "Cloud", "size_bytes": 4}
            )
            assert created.status_code == 201
            asset = created.json()
            key = f"{asset['id']}.ply"
            pending, ready = f"library/_uploads/{key}", f"library/{key}"
            assert (await client.get("/api/v1/library")).json() == []
            # Bytes go to S3, never a backend content route.
            assert (await client.put(f"/api/v1/library/{asset['id']}/content")).status_code == 404
            inspect_response(stub, key=pending)
            promoted(stub, pending, ready)
            original_commit = AsyncSession.commit

            async def fail_commit(self):
                raise RuntimeError("SQL unavailable")

            # begin() commits via the transaction, so fail flush before it instead.
            original_flush = AsyncSession.flush
            monkeypatch.setattr(AsyncSession, "flush", fail_commit)
            with pytest.raises(RuntimeError, match="SQL unavailable"):
                await client.post(f"/api/v1/library/{asset['id']}/complete")
            monkeypatch.setattr(AsyncSession, "flush", original_flush)
            missing(stub, pending)
            inspect_response(stub, key=ready)
            completed = await client.post(f"/api/v1/library/{asset['id']}/complete")
            assert completed.status_code == 200
            assert completed.json()["status"] == "ready"
            assert (await client.post(f"/api/v1/library/{asset['id']}/complete")).status_code == 200
            record = await app.state.library_service.repository.get(asset["id"])
            assert record.object_key == key
            assert "https" not in record.object_key
            # A DB commit failure during deletion must restore S3 and retain metadata.
            stub.add_response(
                "head_object",
                {"ContentLength": 4, "ETag": '"etag"'},
                {"Bucket": BUCKET, "Key": ready},
            )
            stub.add_response(
                "copy_object",
                {},
                {
                    "Bucket": BUCKET,
                    "Key": ANY,
                    "CopySource": {"Bucket": BUCKET, "Key": ready},
                    "CopySourceIfMatch": '"etag"',
                },
            )
            stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ready})
            missing(stub, pending)
            stub.add_response(
                "copy_object",
                {},
                {"Bucket": BUCKET, "Key": ready, "CopySource": {"Bucket": BUCKET, "Key": ANY}},
            )
            stub.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": ANY})
            monkeypatch.setattr(AsyncSession, "commit", fail_commit)
            with pytest.raises(RuntimeError, match="SQL unavailable"):
                await client.delete(f"/api/v1/library/{asset['id']}")
            monkeypatch.setattr(AsyncSession, "commit", original_commit)
            assert len((await client.get("/api/v1/library")).json()) == 1
    finally:
        await app.state.project_repository.close()

    reopened = create_app(settings, library_storage=adapter)
    await reopened.state.project_repository.initialize()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=reopened), base_url="http://test"
        ) as guest:
            assert len((await guest.get("/api/v1/library")).json()) == 1
            for method, url in [
                ("POST", "/api/v1/library/uploads"),
                ("POST", f"/api/v1/library/{asset['id']}/complete"),
                ("DELETE", f"/api/v1/library/{asset['id']}"),
            ]:
                assert (await guest.request(method, url, json={})).status_code == 401
    finally:
        await reopened.state.project_repository.close()


async def test_provider_error_is_sanitized_and_does_not_confirm_upload(storage, tmp_path):
    adapter, stub = storage
    app = create_editor_app(
        Settings(_env_file=None, database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}"),
        library_storage=adapter,
    )
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            asset = (
                await client.post(
                    "/api/v1/library/uploads", json={"name": "Cloud", "size_bytes": 4}
                )
            ).json()
            stub.add_client_error(
                "head_object",
                service_error_code="AccessDenied",
                service_message="private AWS details",
                http_status_code=403,
                expected_params={"Bucket": BUCKET, "Key": f"library/_uploads/{asset['id']}.ply"},
            )
            response = await client.post(f"/api/v1/library/{asset['id']}/complete")
            assert response.status_code == 502
            assert "private AWS details" not in response.text
            assert (await client.get("/api/v1/library")).json() == []
    finally:
        await app.state.project_repository.close()


def test_dotenv_credentials_and_s3_selection(tmp_path: Path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text(
        "CAMERA_PATH_AWS_LIBRARY_STORAGE=s3\nCAMERA_PATH_AWS_S3_BUCKET=test-library\n"
        "CAMERA_PATH_AWS_S3_PREFIX=custom/library/\nCAMERA_PATH_AWS_S3_URL_TTL_SECONDS=600\n"
        "CAMERA_PATH_AWS_REGION=us-east-1\nAWS_ACCESS_KEY_ID=local-key\n"
        "AWS_SECRET_ACCESS_KEY=local-secret\nAWS_SESSION_TOKEN=local-token\n"
    )
    settings = Settings(_env_file=env)
    assert "local-secret" not in repr(settings)
    session = Mock()
    factory = Mock(return_value=session)
    monkeypatch.setattr(boto3, "Session", factory)
    app = create_app(settings)
    assert isinstance(app.state.library_service.storage, S3LibraryStorage)
    assert app.state.library_service.storage.bucket == "test-library"
    assert app.state.library_service.storage.prefix == "custom/library/"
    assert app.state.library_service.storage.ttl == 600
    factory.assert_called_once_with(
        profile_name=None,
        region_name="us-east-1",
        aws_access_key_id="local-key",
        aws_secret_access_key="local-secret",
        aws_session_token="local-token",
    )
    assert session.client.call_args.kwargs["config"].signature_version == "s3v4"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"CAMERA_PATH_AWS_LIBRARY_STORAGE": "s3"},
        {"CAMERA_PATH_AWS_S3_PREFIX": "../"},
        {"CAMERA_PATH_AWS_S3_URL_TTL_SECONDS": 0},
        {"AWS_ACCESS_KEY_ID": "key"},
    ],
)
def test_invalid_s3_configuration_fails_fast(kwargs):
    with pytest.raises(ValueError):
        Settings(_env_file=None, **kwargs)
