import argparse
import asyncio
import logging
import os
import sys
from contextlib import suppress
from pathlib import Path

from dotenv import load_dotenv

from .rabbitmq import consume
from .service import GenerationService
from .trellis_runner import TrellisRunner


def main() -> None:
    env_dir = Path("generation") if Path("generation/pyproject.toml").is_file() else Path.cwd()
    load_dotenv(env_dir / ".env", override=False)

    parser = argparse.ArgumentParser(description="Run the standalone Trellis generation worker")
    parser.add_argument("--model-dir", type=Path, default=os.getenv("GENERATION_MODEL_DIR") or None)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=os.getenv("GENERATION_OUTPUT_DIR") or Path.home() / ".camera-path" / "generation",
    )
    parser.add_argument(
        "--trellis-port-dir", type=Path, default=os.getenv("GENERATION_TRELLIS_PORT_DIR") or None
    )
    parser.add_argument(
        "--request-queue",
        default=os.getenv("GENERATION_REQUEST_QUEUE") or "camera-path.generation.requests",
    )
    parser.add_argument(
        "--result-queue",
        default=os.getenv("GENERATION_RESULT_QUEUE") or "camera-path.generation.results",
    )
    args = parser.parse_args()
    if args.model_dir is None:
        parser.error("Set GENERATION_MODEL_DIR in generation/.env or pass --model-dir")
    model_dir = args.model_dir.expanduser().resolve()
    if not (model_dir / "pipeline.json").is_file():
        parser.error("The model directory must contain the Trellis pipeline.json")
    if args.trellis_port_dir is not None:
        port_dir = args.trellis_port_dir.expanduser().resolve()
        if not (port_dir / "trellis" / "pipelines").is_dir():
            parser.error("The Trellis port directory must contain trellis/pipelines")
        sys.path.insert(0, str(port_dir))

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    url = os.environ.get("GENERATION_AMQP_URL", "amqp://guest:guest@127.0.0.1:5672/")
    output_dir = args.output_dir.expanduser().resolve()
    service = GenerationService(output_dir, TrellisRunner(model_dir))
    with suppress(KeyboardInterrupt):
        asyncio.run(consume(url, args.request_queue, args.result_queue, service.process))


if __name__ == "__main__":
    main()
