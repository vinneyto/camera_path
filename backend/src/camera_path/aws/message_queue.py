"""SQS adapter: the message body, not an S3 notification, is the domain payload."""

import asyncio
from contextlib import asynccontextmanager, suppress

from pydantic import ValidationError

from camera_path.aws.clients import aws_client, run_io
from camera_path.services.job_completion_models import MAX_MESSAGE_BYTES, JobCompletionMessage
from camera_path.services.message_queue import Delivery, MessageQueue


class SQSMessageQueue(MessageQueue):
    def __init__(self, client, queue_url: str, failure_url: str, lease_seconds: int = 60):
        self.client, self.queue_url, self.failure_url = client, queue_url, failure_url
        self.lease_seconds = lease_seconds
        self._bodies: dict[str, str] = {}
        self._renewals: dict[str, asyncio.Task] = {}

    @classmethod
    def from_settings(cls, settings):
        return cls(
            aws_client(settings, "sqs"),
            settings.sqs_queue_url,
            settings.sqs_failure_queue_url,
            settings.message_queue_lease_seconds,
        )

    async def receive(self) -> Delivery | None:
        response = await run_io(
            lambda: self.client.receive_message(
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,
                VisibilityTimeout=self.lease_seconds,
                MessageSystemAttributeNames=["ApproximateReceiveCount"],
            )
        )
        for raw in response.get("Messages", []):
            body, receipt = raw["Body"], raw["ReceiptHandle"]
            self._bodies[receipt] = body
            try:
                if len(body.encode()) > MAX_MESSAGE_BYTES:
                    raise ValueError("Oversized message")
                message = JobCompletionMessage.model_validate_json(body)
            except (ValueError, ValidationError):
                await self.reject(receipt, "validation_error")
                return None
            return Delivery(
                message, receipt, int(raw.get("Attributes", {}).get("ApproximateReceiveCount", "1"))
            )
        return None

    async def ack(self, receipt: str) -> None:
        await self._stop_renewal(receipt)
        try:
            await run_io(
                lambda: self.client.delete_message(QueueUrl=self.queue_url, ReceiptHandle=receipt)
            )
        finally:
            self._bodies.pop(receipt, None)

    async def retry(self, receipt: str, delay: int) -> None:
        await self._stop_renewal(receipt)
        try:
            await self._visibility(receipt, delay)
        finally:
            self._bodies.pop(receipt, None)

    async def reject(self, receipt: str, error_code: str) -> None:
        body = self._bodies[receipt]
        try:
            await run_io(
                lambda: self.client.send_message(
                    QueueUrl=self.failure_url,
                    MessageBody=body,
                    MessageAttributes={
                        "error_code": {"DataType": "String", "StringValue": error_code}
                    },
                )
            )
        except Exception:
            self._bodies.pop(receipt, None)
            raise
        await self.ack(receipt)

    async def _visibility(self, receipt: str, seconds: int) -> None:
        await run_io(
            lambda: self.client.change_message_visibility(
                QueueUrl=self.queue_url, ReceiptHandle=receipt, VisibilityTimeout=seconds
            )
        )

    async def _stop_renewal(self, receipt: str) -> None:
        task = self._renewals.pop(receipt, None)
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    @asynccontextmanager
    async def hold(self, receipt: str):
        async def renew():
            while True:
                await asyncio.sleep(max(0.1, self.lease_seconds / 3))
                await self._visibility(receipt, self.lease_seconds)

        try:
            async with asyncio.TaskGroup() as tasks:
                self._renewals[receipt] = tasks.create_task(renew())
                try:
                    yield
                finally:
                    await self._stop_renewal(receipt)
        finally:
            self._bodies.pop(receipt, None)

    async def aclose(self) -> None:
        await run_io(self.client.close)
