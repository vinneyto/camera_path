import argparse
import asyncio
import logging
import os
from contextlib import suppress
from pathlib import Path

from .rabbitmq import consume
from .service import GenerationService
from .trellis_runner import TrellisRunner


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the standalone Trellis generation worker")
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--request-queue", default="camera-path.generation.requests")
    parser.add_argument("--result-queue", default="camera-path.generation.results")
    args = parser.parse_args()
    if not (args.model_dir / "pipeline.json").is_file():
        parser.error("--model-dir must contain the Trellis pipeline.json")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    url = os.environ.get("GENERATION_AMQP_URL", "amqp://guest:guest@127.0.0.1:5672/")
    service = GenerationService(args.output_dir.resolve(), TrellisRunner(args.model_dir.resolve()))
    with suppress(KeyboardInterrupt):
        asyncio.run(consume(url, args.request_queue, args.result_queue, service.process))


if __name__ == "__main__":
    main()
