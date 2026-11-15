import argparse
import asyncio
import logging
import os
from contextlib import suppress
from pathlib import Path

from dotenv import load_dotenv

from .flux_runner import FluxRunner
from .rabbitmq import consume
from .service import PainterService


def main():
    root = Path("painter") if Path("painter/pyproject.toml").is_file() else Path.cwd()
    load_dotenv(root / ".env", override=False)
    parser = argparse.ArgumentParser(
        description="Run the standalone local image worker"
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=os.getenv("PAINTER_MODEL_DIR", "~/.camera-path/models/flux2-klein-4b"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=os.getenv("PAINTER_OUTPUT_DIR", "~/.camera-path/painter"),
    )
    parser.add_argument(
        "--request-queue",
        default=os.getenv("PAINTER_REQUEST_QUEUE", "camera-path.painter.requests"),
    )
    parser.add_argument(
        "--result-queue",
        default=os.getenv("PAINTER_RESULT_QUEUE", "camera-path.painter.results"),
    )
    args = parser.parse_args()
    model = args.model_dir.expanduser().resolve()
    if not (model / "painter.json").is_file():
        parser.error(
            "Prepare PAINTER_MODEL_DIR with painter/scripts/prepare_model.py or Dev Setup"
        )
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    runner = FluxRunner(
        model,
        device=os.getenv("PAINTER_DEVICE", "mps"),
        unload_after_job=os.getenv("PAINTER_UNLOAD_AFTER_JOB", "1") != "0",
    )
    service = PainterService(args.output_dir.expanduser().resolve(), runner)
    with suppress(KeyboardInterrupt):
        asyncio.run(
            consume(
                os.getenv("PAINTER_AMQP_URL", "amqp://guest:guest@127.0.0.1:5672/"),
                args.request_queue,
                args.result_queue,
                service.process,
            )
        )


if __name__ == "__main__":
    main()
