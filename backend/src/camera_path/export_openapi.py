from __future__ import annotations

import argparse
import json
from pathlib import Path

from camera_path.api import create_app
from camera_path.config import Settings


def export_schema(destination: Path, *, dev: bool = False) -> None:
    application = create_app(Settings(_env_file=None, message_queue="dev")) if dev else create_app()
    destination.write_text(
        json.dumps(application.openapi(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def run() -> None:
    parser = argparse.ArgumentParser(description="Export the generated Camera Path OpenAPI schema")
    parser.add_argument("destination", nargs="?", type=Path, default=Path("openapi.json"))
    parser.add_argument("--dev", action="store_true", help="Include development queue endpoints")
    args = parser.parse_args()
    export_schema(args.destination, dev=args.dev)


if __name__ == "__main__":
    run()
