import asyncio
import json
import logging

import aio_pika

from .service import MAX_REQUEST_BYTES, ImageRequest

logger = logging.getLogger(__name__)


async def consume(url, request_queue, result_queue, process):
    if request_queue == result_queue:
        raise ValueError("Request and result queues must be distinct")
    connection = await aio_pika.connect_robust(url, timeout=5)
    async with connection:
        channel = await connection.channel(
            publisher_confirms=True, on_return_raises=True
        )
        await channel.set_qos(prefetch_count=1)
        requests = await channel.declare_queue(request_queue, durable=True)
        await channel.declare_queue(result_queue, durable=True)
        lock = asyncio.Lock()

        async def publish(payload, correlation):
            await channel.default_exchange.publish(
                aio_pika.Message(
                    json.dumps(payload, ensure_ascii=False).encode(),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    correlation_id=correlation,
                ),
                routing_key=result_queue,
                mandatory=True,
                timeout=10,
            )

        async def handle(message):
            async with lock, message.process(requeue=True):
                try:
                    if len(message.body) > MAX_REQUEST_BYTES:
                        raise ValueError("Oversized request")
                    request = ImageRequest.model_validate_json(message.body)
                except ValueError:
                    request = None
                if request is not None:
                    await publish(
                        {
                            "schema_version": 1,
                            "job_id": str(request.job_id),
                            "status": "running",
                        },
                        message.correlation_id,
                    )
                result = await asyncio.to_thread(process, message.body)
                await publish(result, message.correlation_id)
                logger.info("Job %s: %s", result["job_id"], result["status"])

        await requests.consume(handle)
        logger.info("Waiting for image requests on %s", request_queue)
        await asyncio.Future()
