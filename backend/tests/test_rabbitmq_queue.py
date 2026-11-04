"""Settlement safety at the broker boundary; real delivery is covered in integration/."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

aio_pika = pytest.importorskip("aio_pika")
from camera_path.dev.message_queue import RabbitMQMessageQueue  # noqa: E402


@pytest.fixture
def delivery():
    message = SimpleNamespace(
        body=b"original bytes",
        message_id="diagnostic-id",
        headers={"camera-path-attempt": 3, "x-delivery-count": 2},
        processed=False,
        channel=object(),
        reject=AsyncMock(),
    )

    async def ack():
        message.processed = True

    message.ack = AsyncMock(side_effect=ack)
    publish = AsyncMock()
    queue = RabbitMQMessageQueue("amqp://localhost/", "completions")
    queue._channel = SimpleNamespace(default_exchange=SimpleNamespace(publish=publish))
    queue._pending["receipt"] = message
    return queue, message, publish


@pytest.mark.parametrize("operation", ["retry", "reject"])
async def test_original_is_acked_only_after_forwarding_confirmation(delivery, operation):
    queue, message, publish = delivery
    publishing, confirmed = asyncio.Event(), asyncio.Event()

    async def forward(*args, **kwargs):
        publishing.set()
        await confirmed.wait()

    publish.side_effect = forward

    async def settle():
        async with queue.hold("receipt"):
            if operation == "retry":
                await queue.retry("receipt", 4)
            else:
                await queue.reject("receipt", "validation_error")

    task = asyncio.create_task(settle())
    try:
        await asyncio.wait_for(publishing.wait(), timeout=2)
        message.ack.assert_not_awaited()
        confirmed.set()
        await task
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    message.ack.assert_awaited_once()
    message.reject.assert_not_awaited()
    forwarded = publish.call_args.args[0]
    assert forwarded.body == message.body
    assert forwarded.delivery_mode == aio_pika.DeliveryMode.PERSISTENT
    assert publish.call_args.kwargs["mandatory"] is True
    if operation == "retry":
        assert publish.call_args.kwargs["routing_key"] == "completions.retry.4"
        assert forwarded.headers == {"camera-path-attempt": 6}
    else:
        assert publish.call_args.kwargs["routing_key"] == "completions.failed"
        assert forwarded.headers == {"error_code": "validation_error"}


@pytest.mark.parametrize("error", [ConnectionError, asyncio.CancelledError])
async def test_failed_or_cancelled_forward_retains_original(delivery, error):
    queue, message, publish = delivery
    publish.side_effect = error()
    with pytest.raises(error):
        async with queue.hold("receipt"):
            await queue.retry("receipt", 1)
    message.ack.assert_not_awaited()
    message.reject.assert_awaited_once_with(requeue=True)


async def test_malformed_message_is_requeued_if_quarantine_is_unavailable(delivery, monkeypatch):
    queue, message, publish = delivery
    queue._pending.clear()
    await queue._inbox.put(message)
    monkeypatch.setattr(queue, "_connect", AsyncMock())
    publish.side_effect = ConnectionError()
    with pytest.raises(ConnectionError):
        await queue.receive()
    message.ack.assert_not_awaited()
    message.reject.assert_awaited_once_with(requeue=True)
    assert not queue._pending


@pytest.mark.parametrize("error", [ConnectionError, asyncio.CancelledError])
async def test_connection_is_closed_when_initial_connect_fails_or_is_cancelled(monkeypatch, error):
    connection = SimpleNamespace(connect=AsyncMock(side_effect=error()), close=AsyncMock())
    monkeypatch.setattr(aio_pika, "RobustConnection", Mock(return_value=connection))
    queue = RabbitMQMessageQueue("amqp://localhost/", "completions")
    with pytest.raises(error):
        await queue.receive()
    connection.close.assert_awaited_once()
    assert queue._connection is None
