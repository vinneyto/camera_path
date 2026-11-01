"""In-memory recording port for domain tests; broker behavior is tested separately."""

from collections import deque
from contextlib import asynccontextmanager
from types import SimpleNamespace
from uuid import uuid4

from camera_path.services.message_queue import Delivery, MessageQueue


class RecordingQueue(MessageQueue):
    def __init__(self):
        self.messages = deque()
        self.states = {}
        self.pending = {}
        self.delays = []

    async def enqueue(self, message):
        self.messages.append(message)
        self.states[message.message_id] = SimpleNamespace(
            status="queued", job_id=message.job_id, attempts=0, error_code=None
        )

    async def receive(self):
        if not self.messages:
            return None
        message = self.messages.popleft()
        state = self.states[message.message_id]
        state.attempts += 1
        state.status = "processing"
        delivery = Delivery(message, str(uuid4()), state.attempts)
        self.pending[delivery.receipt] = delivery
        return delivery

    @asynccontextmanager
    async def hold(self, receipt):
        try:
            yield
        finally:
            if receipt in self.pending:
                await self.retry(receipt, 0)

    async def status(self, message_id):
        return self.states[message_id]

    async def ack(self, receipt):
        delivery = self.pending.pop(receipt)
        self.states[delivery.message.message_id].status = "succeeded"

    async def retry(self, receipt, delay):
        delivery = self.pending.pop(receipt)
        self.delays.append(delay)
        self.messages.append(delivery.message)
        self.states[delivery.message.message_id].status = "queued"

    async def reject(self, receipt, error_code):
        delivery = self.pending.pop(receipt)
        state = self.states[delivery.message.message_id]
        state.status, state.error_code = "failed", error_code

    async def aclose(self):
        pass
