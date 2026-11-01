"""Configure infrastructure around the provider-independent application factory."""

from collections.abc import Callable
from functools import wraps
from pathlib import Path

from fastapi import FastAPI

from camera_path.config import Settings, settings
from camera_path.dev import records as dev_records  # noqa: F401
from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.repositories import ProjectRepository
from camera_path.services.app_dependencies import AppDependencies
from camera_path.services.auth_email import AuthEmailSender
from camera_path.services.library_storage import LibraryStorage
from camera_path.services.message_queue import MessageQueue

API_PREFIX = "/api/v1"


def _library_storage(configured: Settings) -> LibraryStorage:
    if configured.library_storage == "s3":
        from camera_path.aws.library_storage import S3LibraryStorage

        return S3LibraryStorage.from_settings(configured)
    return LocalLibraryStorage(configured.library_directory)


def _email_sender(configured: Settings) -> AuthEmailSender | None:
    if configured.auth_second_factor == "off":
        return None
    if configured.auth_email_delivery == "ses":
        from camera_path.aws.auth_email import SesAuthEmailSender

        return SesAuthEmailSender(configured)
    from camera_path.dev.auth_email import SmtpAuthEmailSender

    return SmtpAuthEmailSender(
        configured.auth_email_from, configured.auth_smtp_host, configured.auth_smtp_port
    )


def _message_queue(configured: Settings, repository: ProjectRepository) -> MessageQueue | None:
    if configured.message_queue == "none":
        return None
    if configured.message_queue == "dev":
        from camera_path.dev.message_queue import DevMessageQueue

        return DevMessageQueue(repository.session_factory, configured.message_queue_lease_seconds)
    from camera_path.aws.message_queue import SQSMessageQueue

    return SQSMessageQueue.from_settings(configured)


def _import_sources(configured: Settings) -> dict[str, LibraryStorage]:
    sources: dict[str, LibraryStorage] = {}
    for name, source in configured.library_import_sources.items():
        if source.driver == "local":
            sources[name] = LocalLibraryStorage(Path(source.root))
        else:
            from camera_path.aws.clients import aws_client
            from camera_path.aws.library_storage import S3LibraryStorage

            sources[name] = S3LibraryStorage(
                aws_client(configured, "s3"), source.bucket, source.prefix
            )
    return sources


def _include_adapter_routes(application: FastAPI, dependencies: AppDependencies) -> None:
    from camera_path.dev.message_queue import DevMessageQueue

    if isinstance(dependencies.message_queue, DevMessageQueue):
        from camera_path.dev.import_routes import router as import_router

        application.include_router(import_router, prefix=API_PREFIX)
    if isinstance(dependencies.library_storage, LocalLibraryStorage):
        from camera_path.dev.library_routes import router as local_library_router

        application.include_router(local_library_router, prefix=API_PREFIX)
    application.openapi_schema = None


def with_infrastructure(
    factory: Callable[[Settings, AppDependencies], FastAPI],
) -> Callable[..., FastAPI]:
    @wraps(factory)
    def configured_app(
        app_settings: Settings | None = None,
        repository: ProjectRepository | None = None,
        library_storage: LibraryStorage | None = None,
    ) -> FastAPI:
        configured = app_settings or settings
        project_repository = (
            repository if repository is not None else ProjectRepository(configured.database_url)
        )
        queue = _message_queue(configured, project_repository)
        dependencies = AppDependencies(
            repository=project_repository,
            owns_repository=repository is None,
            library_storage=(
                library_storage if library_storage is not None else _library_storage(configured)
            ),
            email_sender=_email_sender(configured),
            message_queue=queue,
            import_sources=_import_sources(configured) if queue is not None else {},
        )
        application = factory(configured, dependencies)
        _include_adapter_routes(application, dependencies)
        return application

    return configured_app
