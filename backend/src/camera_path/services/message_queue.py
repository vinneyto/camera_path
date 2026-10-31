"""Transport-neutral delivery lifecycle, including explicit acknowledgement."""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from camera_path.services.library_import_models import LibraryImportMessage


@dataclass(frozen=True)
class Delivery:
    message: LibraryImportMessage
    receipt: str
    attempts: int


class MessageQueue(ABC):
    @abstractmethod
    async def receive(self) -> Delivery | None: ...

    @abstractmethod
    async def ack(self, receipt: str, asset_id: str) -> None: ...

    @abstractmethod
    async def retry(self, receipt: str, delay: int) -> None: ...

    @abstractmethod
    async def reject(self, receipt: str, error_code: str) -> None: ...

    @abstractmethod
    async def extend_lease(self, receipt: str) -> None: ...
