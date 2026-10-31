"""Composition root for queue and source providers. No business decisions here."""

from pathlib import Path

from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.services.library_consumer import LibraryImportConsumer
from camera_path.services.library_import import LibraryImportService


def compose_imports(settings, library):
    if settings.message_queue == "none":
        return None, None, None
    if settings.message_queue == "dev":
        from camera_path.dev.message_queue import DevMessageQueue

        queue = DevMessageQueue(library.repository.sessions, settings.message_queue_lease_seconds)
    else:
        from camera_path.aws.message_queue import SQSMessageQueue

        queue = SQSMessageQueue.from_settings(settings)
    sources = {}
    for name, source in settings.library_import_sources.items():
        if source.driver == "local":
            sources[name] = LocalLibraryStorage(Path(source.root))
        else:
            from camera_path.aws.clients import aws_client
            from camera_path.aws.library_storage import S3LibraryStorage

            sources[name] = S3LibraryStorage(
                aws_client(settings, "s3"), source.bucket, source.prefix
            )
    importer = LibraryImportService(library, sources)
    consumer = LibraryImportConsumer(
        queue, importer, settings.message_queue_max_attempts, settings.message_queue_lease_seconds
    )
    return queue, importer, consumer
