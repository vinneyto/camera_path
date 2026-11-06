"""Application-lifespan consumer. No queue-engine branching or provider imports."""

import asyncio
import logging
import time

from camera_path.services.library_metadata import LibraryError
from camera_path.services.message_queue import MessageQueue

logger = logging.getLogger(__name__)


class JobCompletionConsumer:
    def __init__(self, queue: MessageQueue, importer, max_attempts=5, on_rejection=None):
        self.queue, self.importer = queue, importer
        self.max_attempts = max_attempts
        self.on_rejection = on_rejection

    async def _reject(self, delivery, code: str):
        if self.on_rejection is not None:
            await self.on_rejection(delivery.message, code)
        await self.queue.reject(delivery.receipt, code)

    async def process(self, delivery):
        async with self.queue.hold(delivery.receipt):
            try:
                await self.importer.register(delivery.message)
            except LibraryError as error:
                await self._reject(delivery, error.code)
                logger.info(
                    "Import rejected message=%s job=%s attempt=%s code=%s",
                    delivery.message.message_id,
                    delivery.message.job_id,
                    delivery.attempts,
                    error.code,
                )
            except Exception:
                if delivery.attempts >= self.max_attempts:
                    await self._reject(delivery, "library_import_unavailable")
                else:
                    await self.queue.retry(
                        delivery.receipt, min(60, 2 ** min(delivery.attempts - 1, 6))
                    )
                logger.warning(
                    "Import retry/failure message=%s job=%s attempt=%s",
                    delivery.message.message_id,
                    delivery.message.job_id,
                    delivery.attempts,
                )
            else:
                await self.queue.ack(delivery.receipt)

    async def run(self):
        recovery_at = 0
        while True:
            try:
                if time.monotonic() >= recovery_at:
                    await self.importer.recover()
                    recovery_at = time.monotonic() + 60
                delivery = await self.queue.receive()
                if delivery is not None:
                    await self.process(delivery)
            except asyncio.CancelledError:
                raise
            except Exception:
                # An unavailable queue never takes down HTTP or drops its unacked message.
                logger.warning("Import queue temporarily unavailable")
                await asyncio.sleep(1)
