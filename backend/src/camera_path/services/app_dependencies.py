"""Provider-independent dependencies supplied to the core application factory."""

from dataclasses import dataclass

from camera_path.repositories import ProjectRepository
from camera_path.services.auth_email import AuthEmailSender
from camera_path.services.library_storage import LibraryStorage
from camera_path.services.message_queue import MessageQueue


@dataclass(frozen=True)
class AppDependencies:
    repository: ProjectRepository
    owns_repository: bool
    library_storage: LibraryStorage
    email_sender: AuthEmailSender | None
    message_queue: MessageQueue | None
    import_sources: dict[str, LibraryStorage]
