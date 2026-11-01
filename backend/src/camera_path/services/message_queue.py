"""Transport-neutral delivery and settlement; providers own connection/lease details."""

from abc import ABC, abstractmethod
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass

from camera_path.services.job_completion_models import JobCompletionMessage


@dataclass(frozen=True)
class Delivery:
    message: JobCompletionMessage
    receipt: str
    attempts: int


class MessageQueue(ABC):
    @abstractmethod
    async def receive(self) -> Delivery | None: ...

    @abstractmethod
    def hold(self, receipt: str) -> AbstractAsyncContextManager[None]: ...

    @abstractmethod
    async def ack(self, receipt: str) -> None: ...

    @abstractmethod
    async def retry(self, receipt: str, delay: int) -> None: ...

    @abstractmethod
    async def reject(self, receipt: str, error_code: str) -> None: ...

    @abstractmethod
    async def aclose(self) -> None: ...
