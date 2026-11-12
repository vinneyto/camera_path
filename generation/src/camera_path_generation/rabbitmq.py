import asyncio
import json
import logging
from collections.abc import Callable

import aio_pika
from aio_pika.abc import AbstractIncomingMessage

from .service import MAX_REQUEST_BYTES, GenerationRequest

logger = logging.getLogger(__name__)


async def consume(
    url: str, request_queue: str, result_queue: str, process: Callable[[bytes], dict]
) -> None:
    if request_queue == result_queue:
        raise ValueError("Request and result queues must be distinct")

    connection = await aio_pika.connect_robust(url, timeout=5)
    async with connection:
        channel = await connection.channel(publisher_confirms=True, on_return_raises=True)
        await channel.set_qos(prefetch_count=1)
        requests = await channel.declare_queue(request_queue, durable=True)
        await channel.declare_queue(result_queue, durable=True)
        lock = asyncio.Lock()

        async def handle(message: AbstractIncomingMessage) -> None:
            async with lock, message.process(requeue=True):
                try:
                    if len(message.body) > MAX_REQUEST_BYTES:
                        raise ValueError("Request too large")
                    request = GenerationRequest.model_validate_json(message.body)
                except ValueError:
                    request = None
                if request is not None:
                    await channel.default_exchange.publish(
                        aio_pika.Message(
                            json.dumps(
                                {
                                    "schema_version": 1,
                                    "job_id": str(request.job_id),
                                    "status": "running",
                                }
                            ).encode(),
                            content_type="application/json",
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                            correlation_id=message.correlation_id,
                        ),
                        routing_key=result_queue,
                        mandatory=True,
                        timeout=10,
                    )
                result = await asyncio.to_thread(process, message.body)
                await channel.default_exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(result, ensure_ascii=False).encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                        correlation_id=message.correlation_id,
                    ),
                    routing_key=result_queue,
                    mandatory=True,
                    timeout=10,
                )
                logger.info("Job %s: %s", result["job_id"], result["status"])

        await requests.consume(handle)
        logger.info("Waiting for generation requests on %s", request_queue)
        await asyncio.Future()
