"""RabbitMQ delivery, retries and quarantine. No domain persistence or HTTP routes."""

import asyncio
from contextlib import asynccontextmanager, suppress
from uuid import uuid4

import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from aio_pika.connection import make_url

from camera_path.services.job_completion_models import MAX_MESSAGE_BYTES, JobCompletionMessage
from camera_path.services.message_queue import Delivery, MessageQueue

RETRY_DELAYS = (1, 2, 4, 8, 16, 32, 60)


class RabbitMQMessageQueue(MessageQueue):
    def __init__(self, url: str, queue_name: str):
        self.url, self.queue_name = url, queue_name
        self._connection = self._channel = None
        self._inbox: asyncio.Queue[AbstractIncomingMessage] = asyncio.Queue(maxsize=1)
        self._pending: dict[str, AbstractIncomingMessage] = {}

    async def _connect(self):
        if self._connection is not None:
            await self._channel.ready()
            return
        connection = aio_pika.RobustConnection(make_url(self.url), reconnect_interval=1)
        try:
            await connection.connect(timeout=5)
            channel = await connection.channel(publisher_confirms=True, on_return_raises=True)
            await channel.set_qos(prefetch_count=1)
            arguments = {"x-queue-type": "quorum", "x-delivery-limit": -1}
            queue = await channel.declare_queue(self.queue_name, durable=True, arguments=arguments)
            await channel.declare_queue(
                self.queue_name + ".failed", durable=True, arguments=arguments
            )
            for delay in RETRY_DELAYS:
                await channel.declare_queue(
                    f"{self.queue_name}.retry.{delay}",
                    durable=True,
                    arguments={
                        **arguments,
                        "x-message-ttl": delay * 1000,
                        "x-dead-letter-exchange": "",
                        "x-dead-letter-routing-key": self.queue_name,
                        "x-dead-letter-strategy": "at-least-once",
                        "x-overflow": "reject-publish",
                    },
                )
            await queue.consume(self._inbox.put, no_ack=False)
        except BaseException:
            await connection.close()
            raise
        self._connection, self._channel = connection, channel

    @staticmethod
    def _attempts(message):
        headers = message.headers or {}
        return max(1, int(headers.get("camera-path-attempt", 1))) + max(
            0, int(headers.get("x-delivery-count", 0))
        )

    async def receive(self) -> Delivery | None:
        await self._connect()
        try:
            message = await asyncio.wait_for(self._inbox.get(), timeout=1)
        except TimeoutError:
            return None
        receipt = str(uuid4())
        self._pending[receipt] = message
        try:
            # An old delivery cannot be settled on a reconnected channel.
            _ = message.channel
            if len(message.body) > MAX_MESSAGE_BYTES:
                raise ValueError("Oversized message")
            payload = JobCompletionMessage.model_validate_json(message.body)
            attempts = self._attempts(message)
        except (ValueError, TypeError, OverflowError):
            async with self.hold(receipt):
                await self.reject(receipt, "validation_error")
            return None
        except BaseException:
            self._pending.pop(receipt, None)
            raise
        return Delivery(payload, receipt, attempts)

    @asynccontextmanager
    async def hold(self, receipt: str):
        try:
            yield
        finally:
            message = self._pending.pop(receipt)
            if not message.processed:
                # A failed ack/publish or cancellation must never discard the original.
                with suppress(aio_pika.exceptions.ChannelInvalidStateError):
                    await message.reject(requeue=True)

    async def ack(self, receipt: str) -> None:
        await self._pending[receipt].ack()

    async def _forward(self, receipt, queue_name, headers):
        message = self._pending[receipt]
        await self._channel.default_exchange.publish(
            aio_pika.Message(
                body=message.body,
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message.message_id,
                headers=headers,
            ),
            routing_key=queue_name,
            mandatory=True,
            timeout=10,
        )
        await self.ack(receipt)

    async def retry(self, receipt: str, delay: int) -> None:
        if delay not in RETRY_DELAYS:
            raise ValueError("Unsupported retry delay")
        await self._forward(
            receipt,
            f"{self.queue_name}.retry.{delay}",
            {"camera-path-attempt": self._attempts(self._pending[receipt]) + 1},
        )

    async def reject(self, receipt: str, error_code: str) -> None:
        await self._forward(receipt, self.queue_name + ".failed", {"error_code": error_code})

    async def aclose(self) -> None:
        if self._connection is not None:
            await self._connection.close()
        self._connection = self._channel = None
        self._pending.clear()
        while not self._inbox.empty():
            self._inbox.get_nowait()
