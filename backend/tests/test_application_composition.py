import ast
import asyncio
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest
from starlette.routing import NoMatchFound

from camera_path.api import create_app
from camera_path.composition import with_infrastructure
from camera_path.config import Settings
from camera_path.dev.auth_email import SmtpAuthEmailSender
from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.dev.message_queue import DevMessageQueue
from camera_path.repositories import ProjectRepository
from camera_path.services.app_dependencies import AppDependencies


def configuration(tmp_path, **values):
    return Settings(
        _env_file=None,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
        library_directory=tmp_path / "library",
        **values,
    )


def has_route(application, name, **parameters):
    try:
        application.url_path_for(name, **parameters)
    except NoMatchFound:
        return False
    return True


def test_default_composition_has_only_filesystem_routes_and_smtp(tmp_path):
    app = create_app(configuration(tmp_path))
    assert isinstance(app.state.library_service.storage, LocalLibraryStorage)
    assert isinstance(app.state.auth_service.sender, SmtpAuthEmailSender)
    assert app.state.message_queue is None
    assert app.state.job_completion_service is None
    assert app.state.job_completion_consumer is None
    assert has_route(app, "download_local_library_content", asset_id="asset")
    assert "/api/v1/dev/job-completions" not in app.openapi()["paths"]
    assert not (tmp_path / "db.sqlite3").exists()


def test_dev_composition_injects_shared_sessions_and_sources(tmp_path):
    app = create_app(
        configuration(
            tmp_path,
            message_queue="dev",
            library_import_sources={
                "incoming": {"driver": "local", "root": str(tmp_path / "incoming")}
            },
        )
    )
    assert isinstance(app.state.message_queue, DevMessageQueue)
    assert app.state.message_queue.sessions is app.state.project_repository.session_factory
    sources = app.state.job_completion_service.sources
    assert sources["incoming"].directory == tmp_path / "incoming"
    assert sources["library"] is app.state.library_service.storage
    assert app.state.job_completion_consumer.queue is app.state.message_queue
    assert "/api/v1/dev/job-completions" in app.openapi()["paths"]
    assert has_route(app, "download_local_library_content", asset_id="asset")


def test_storage_override_controls_routes_independently_of_queue(tmp_path):
    pytest.importorskip("boto3")
    from camera_path.aws.library_storage import S3LibraryStorage

    store = S3LibraryStorage(Mock(), "test-library")
    app = create_app(configuration(tmp_path, message_queue="dev"), library_storage=store)
    assert app.state.library_service.storage is store
    assert isinstance(app.state.message_queue, DevMessageQueue)
    assert "/api/v1/dev/job-completions" in app.openapi()["paths"]
    assert not has_route(app, "download_local_library_content", asset_id="asset")
    assert not has_route(app, "download_local_library_thumbnail", asset_id="asset")


def test_local_override_bypasses_configured_s3_construction(tmp_path, monkeypatch):
    pytest.importorskip("boto3")
    from camera_path.aws.library_storage import S3LibraryStorage

    def unexpected(*args):
        raise AssertionError("An explicit storage override must bypass the configured provider")

    monkeypatch.setattr(S3LibraryStorage, "from_settings", unexpected)
    store = LocalLibraryStorage(tmp_path / "override")
    app = create_app(
        configuration(
            tmp_path, CAMERA_PATH_AWS_LIBRARY_STORAGE="s3", CAMERA_PATH_AWS_S3_BUCKET="unused"
        ),
        library_storage=store,
    )
    assert app.state.library_service.storage is store
    assert has_route(app, "download_local_library_content", asset_id="asset")


def test_sqs_and_ses_selection_does_not_select_storage_or_mount_dev_queue(tmp_path, monkeypatch):
    boto3 = pytest.importorskip("boto3")
    from camera_path.aws.auth_email import SesAuthEmailSender
    from camera_path.aws.message_queue import SQSMessageQueue

    client = Mock()
    session = Mock()
    session.client.return_value = client
    monkeypatch.setattr(boto3, "Session", Mock(return_value=session))
    app = create_app(
        configuration(
            tmp_path,
            environment="production",
            auth_email_delivery="ses",
            message_queue="sqs",
            CAMERA_PATH_AWS_SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123/jobs",
            CAMERA_PATH_AWS_SQS_FAILURE_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123/failures",
            library_import_sources={
                "incoming": {"driver": "s3", "bucket": "producer", "prefix": "ready/"}
            },
        )
    )
    assert isinstance(app.state.message_queue, SQSMessageQueue)
    assert isinstance(app.state.auth_service.sender, SesAuthEmailSender)
    assert isinstance(app.state.library_service.storage, LocalLibraryStorage)
    assert app.state.job_completion_service.sources["incoming"].client is client
    assert "/api/v1/dev/job-completions" not in app.openapi()["paths"]
    assert has_route(app, "download_local_library_content", asset_id="asset")
    assert [call.args[0] for call in session.client.call_args_list] == ["sqs", "s3"]
    client.assert_not_called()
    assert client.method_calls == []


def test_local_startup_with_disabled_queue_needs_no_aws_packages_or_sources(tmp_path):
    environment = {
        name: value
        for name, value in os.environ.items()
        if not name.startswith(("CAMERA_PATH_", "AWS_", "OPENAI_"))
    }
    environment["CAMERA_PATH_DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}"
    environment["CAMERA_PATH_LIBRARY_DIRECTORY"] = str(tmp_path / "library")
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; sys.modules['boto3'] = None; sys.modules['botocore'] = None; "
            "from camera_path.api import create_app; from camera_path.config import Settings; "
            "app = create_app(Settings(_env_file=None, auth_second_factor='off', "
            "library_import_sources={'incoming': {'driver': 's3', 'bucket': 'unused'}})); "
            "assert app.state.message_queue is None; "
            "assert app.state.auth_service.sender is None; "
            "assert app.state.job_completion_consumer is None; "
            "app.openapi()",
        ],
        env=environment,
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert not (tmp_path / "db.sqlite3").exists()


def test_raw_factory_uses_only_injected_contracts_and_core_routes(tmp_path):
    configured = configuration(tmp_path, message_queue="dev")
    repository = ProjectRepository(configured.database_url)
    store = LocalLibraryStorage(tmp_path / "injected")
    sender = Mock()
    dependencies = AppDependencies(repository, False, store, sender, None, {})
    app = create_app.__wrapped__(configured, dependencies)
    assert app.state.project_repository is repository
    assert app.state.library_service.storage is store
    assert app.state.auth_service.sender is sender
    assert app.state.job_completion_consumer is None
    assert "/api/v1/jobs" in app.openapi()["paths"]
    assert "/api/v1/dev/job-completions" not in app.openapi()["paths"]
    assert not has_route(app, "download_local_library_content", asset_id="asset")


def test_adapter_routes_refresh_precomputed_openapi(tmp_path):
    @with_infrastructure
    def precomputed(configured, dependencies):
        app = create_app.__wrapped__(configured, dependencies)
        app.openapi()
        return app

    app = precomputed(configuration(tmp_path, message_queue="dev"))
    assert "/api/v1/dev/job-completions" in app.openapi()["paths"]


@pytest.mark.parametrize("owns_repository", [True, False])
async def test_lifespan_cancels_consumer_and_closes_only_owned_repository(
    tmp_path, monkeypatch, owns_repository
):
    configured = configuration(tmp_path, message_queue="dev")
    injected = None if owns_repository else ProjectRepository(configured.database_url)
    app = create_app(configured, repository=injected)
    repository = app.state.project_repository
    close = AsyncMock(wraps=repository.close)
    monkeypatch.setattr(repository, "close", close)
    started, stopped = asyncio.Event(), asyncio.Event()

    async def run():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    consumer = AsyncMock(side_effect=run)
    monkeypatch.setattr(app.state.job_completion_consumer, "run", consumer)
    try:
        with pytest.raises(RuntimeError, match="Serving failed"):
            async with app.router.lifespan_context(app):
                await asyncio.wait_for(started.wait(), timeout=2)
                assert repository._initialized
                raise RuntimeError("Serving failed")
        assert stopped.is_set()
        consumer.assert_awaited_once()
        assert close.await_count == int(owns_repository)
    finally:
        if not owns_repository:
            await repository.close()


def test_core_application_and_auth_do_not_import_providers():
    root = Path(__file__).parents[1] / "src/camera_path"
    for name in ("api.py", "services/auth.py", "services/app_dependencies.py"):
        tree = ast.parse((root / name).read_text())
        for node in ast.walk(tree):
            modules = []
            if isinstance(node, ast.ImportFrom):
                modules = [node.module or ""]
            elif isinstance(node, ast.Import):
                modules = [alias.name for alias in node.names]
            assert not any(
                module.startswith(("camera_path.aws", "camera_path.dev", "boto3", "botocore"))
                for module in modules
            ), name


@pytest.mark.parametrize("failure", ["initialize", "consumer"])
async def test_owned_repository_closes_when_startup_or_consumer_fails(
    tmp_path, monkeypatch, failure
):
    app = create_app(configuration(tmp_path, message_queue="dev"))
    repository = app.state.project_repository
    close = AsyncMock(wraps=repository.close)
    monkeypatch.setattr(repository, "close", close)
    started = asyncio.Event()

    async def fail():
        started.set()
        raise RuntimeError("Infrastructure failed")

    if failure == "initialize":
        monkeypatch.setattr(repository, "initialize", fail)
    else:
        monkeypatch.setattr(app.state.job_completion_consumer, "run", fail)
    with pytest.raises(RuntimeError, match="Infrastructure failed"):
        async with app.router.lifespan_context(app):
            await asyncio.wait_for(started.wait(), timeout=2)
    close.assert_awaited_once()


def test_production_rejects_dev_queue_even_when_settings_validation_was_bypassed(tmp_path):
    configured = configuration(
        tmp_path, environment="production", auth_email_delivery="ses"
    ).model_copy(update={"message_queue": "dev"})
    with pytest.raises(ValueError, match="dev message queue requires development"):
        create_app(configured)
    assert not (tmp_path / "db.sqlite3").exists()
    assert not (tmp_path / "library").exists()


def test_production_rejects_a_miswired_dev_queue_adapter(tmp_path, monkeypatch):
    import camera_path.composition as composition

    configured = configuration(tmp_path, environment="production", auth_email_delivery="ses")
    monkeypatch.setattr(
        composition, "_message_queue", lambda settings, repo: DevMessageQueue(repo.session_factory)
    )
    monkeypatch.setattr(composition, "_email_sender", lambda settings: Mock())
    with pytest.raises(ValueError, match="dev API requires development"):
        create_app(configured)


@pytest.mark.parametrize("environment", [None, "production"])
async def test_mistakenly_mounted_dev_router_is_inaccessible_outside_development(
    tmp_path, environment
):
    from uuid import uuid4

    from httpx import ASGITransport, AsyncClient

    from camera_path.dev.import_routes import router

    app = create_app(configuration(tmp_path))
    app.state.environment = environment
    app.include_router(router, prefix="/api/v1")
    queue = Mock(enqueue=AsyncMock(), status=AsyncMock())
    app.state.message_queue = queue
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (
            await client.post("/api/v1/dev/job-completions", content=b"not json")
        ).status_code == 404
        assert (await client.get(f"/api/v1/dev/job-completions/{uuid4()}")).status_code == 404
    queue.enqueue.assert_not_awaited()
    queue.status.assert_not_awaited()


async def test_production_has_no_dev_routes_or_openapi_entries(tmp_path, monkeypatch):
    from uuid import uuid4

    from httpx import ASGITransport, AsyncClient

    import camera_path.composition as composition

    # HTTP routing needs no actual SES delivery or optional AWS SDK installation.
    monkeypatch.setattr(composition, "_email_sender", lambda settings: Mock())
    app = create_app(configuration(tmp_path, environment="production", auth_email_delivery="ses"))
    assert app.state.environment == "production"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for path in (
            "/api/v1/dev",
            "/api/v1/dev/",
            "/api/v1/dev/job-completions",
            f"/api/v1/dev/job-completions/{uuid4()}",
            "/api/v1/dev/unknown",
        ):
            assert (await client.get(path)).status_code == 404
            assert (await client.post(path, json={})).status_code == 404
        assert (await client.post("/api/v1/jobs")).status_code == 401
        schema = (await client.get("/api/v1/openapi.json")).json()
        assert not any(
            path == "/api/v1/dev" or path.startswith("/api/v1/dev/") for path in schema["paths"]
        )


async def test_dev_submission_and_status_need_no_editor_or_signing_secret(tmp_path):
    from uuid import uuid4

    from httpx import ASGITransport, AsyncClient

    app = create_app(configuration(tmp_path, message_queue="dev"))
    await app.state.project_repository.initialize()
    try:
        job = await app.state.job_service.create()
        payload = {
            "schema_version": 2,
            "message_id": str(uuid4()),
            "job_id": job.id,
            "assets": [
                {
                    "name": "Cloud",
                    "primary_file_id": "main",
                    "files": [
                        {
                            "id": "main",
                            "format": "ply",
                            "size_bytes": 4,
                            "sha256": "a" * 64,
                            "source": {"storage": "library", "path": "cloud.ply"},
                        }
                    ],
                }
            ],
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for headers in ({}, {"Authorization": "Bearer invalid"}):
                assert (
                    await client.post("/api/v1/dev/job-completions", json=payload, headers=headers)
                ).status_code == 202
                result = await client.get(
                    f"/api/v1/dev/job-completions/{payload['message_id']}", headers=headers
                )
                assert result.status_code == 200 and result.json()["job_id"] == job.id
            assert (await client.post("/api/v1/jobs")).status_code == 401
    finally:
        await app.state.project_repository.close()
