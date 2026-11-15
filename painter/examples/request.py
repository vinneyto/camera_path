"""Send an image request while testing painter with dedicated development queues."""

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
from uuid import UUID, uuid4

import aio_pika
from camera_path_painter.service import ImageInput, ImageRequest
from dotenv import load_dotenv


async def request(args):
    if args.request_queue == args.result_queue:
        raise ValueError("Request and result queues must be distinct")
    image = args.image.expanduser().resolve() if args.image else None
    payload = ImageRequest(
        schema_version=1,
        job_id=args.job_id,
        input=ImageInput(
            prompt=args.prompt,
            seed=args.seed,
            image_path=str(image) if image else None,
            image_sha256=hashlib.sha256(image.read_bytes()).hexdigest()
            if image
            else None,
        ),
    )
    connection = await aio_pika.connect(
        os.getenv("PAINTER_AMQP_URL", "amqp://guest:guest@127.0.0.1:5672/"), timeout=5
    )
    async with connection:
        channel = await connection.channel(
            publisher_confirms=True, on_return_raises=True
        )
        await channel.declare_queue(args.request_queue, durable=True)
        results = await channel.declare_queue(args.result_queue, durable=True)
        async with results.iterator() as replies:
            await channel.default_exchange.publish(
                aio_pika.Message(
                    payload.model_dump_json().encode(),
                    content_type="application/json",
                    correlation_id=str(args.job_id),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=args.request_queue,
                mandatory=True,
                timeout=10,
            )
            async with asyncio.timeout(args.timeout):
                async for reply in replies:
                    async with reply.process(requeue=True):
                        if reply.correlation_id != str(args.job_id):
                            raise RuntimeError(
                                "Use fresh, dedicated queues for this example"
                            )
                        result = json.loads(reply.body)
                        if result["status"] != "running":
                            return result


def main():
    root = Path("painter") if Path("painter/pyproject.toml").is_file() else Path.cwd()
    load_dotenv(root / ".env", override=False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt")
    parser.add_argument("--image", type=Path)
    parser.add_argument("--job-id", type=UUID, default=uuid4())
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--request-queue",
        default=os.getenv("PAINTER_REQUEST_QUEUE", "camera-path.painter.requests"),
    )
    parser.add_argument(
        "--result-queue",
        default=os.getenv("PAINTER_RESULT_QUEUE", "camera-path.painter.results"),
    )
    parser.add_argument("--timeout", type=float, default=600)
    print(json.dumps(asyncio.run(request(parser.parse_args())), indent=2))


if __name__ == "__main__":
    main()
