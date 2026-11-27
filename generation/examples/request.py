"""Send one request and print the result using dedicated development queues."""

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
from uuid import UUID, uuid4

import aio_pika


async def request(args: argparse.Namespace) -> dict:
    if args.request_queue == args.result_queue:
        raise ValueError("Request and result queues must be distinct")
    job_id = str(args.job_id)
    correlation_id = str(uuid4())
    body = {"schema_version": 1, "job_id": job_id, "input": {"prompt": args.prompt}}
    if args.image:
        path = args.image.expanduser().resolve()
        body["input"] = {
            "image_path": str(path),
            "image_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    url = os.environ.get("GENERATION_AMQP_URL", "amqp://guest:guest@127.0.0.1:5672/")

    connection = await aio_pika.connect(url, timeout=5)
    async with connection:
        channel = await connection.channel(publisher_confirms=True, on_return_raises=True)
        await channel.declare_queue(args.request_queue, durable=True)
        results = await channel.declare_queue(args.result_queue, durable=True)
        async with results.iterator() as replies:
            await channel.default_exchange.publish(
                aio_pika.Message(
                    json.dumps(body).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    correlation_id=correlation_id,
                ),
                routing_key=args.request_queue,
                mandatory=True,
                timeout=10,
            )
            async with asyncio.timeout(args.timeout):
                async for reply in replies:
                    async with reply.process(requeue=True):
                        if reply.correlation_id != correlation_id:
                            raise RuntimeError(
                                "Unexpected reply. Use fresh, dedicated queues for this example."
                            )
                        result = json.loads(reply.body)
                        if result["status"] != "running":
                            return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt", nargs="?", default="")
    parser.add_argument("--image", type=Path)
    parser.add_argument("--job-id", type=UUID, default=uuid4())
    parser.add_argument("--request-queue", default="camera-path.generation.requests")
    parser.add_argument("--result-queue", default="camera-path.generation.results")
    parser.add_argument("--timeout", type=float, default=180)
    print(json.dumps(asyncio.run(request(parser.parse_args())), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
