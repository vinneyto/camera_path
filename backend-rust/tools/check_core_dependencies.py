"""Fail if infrastructure providers leak into the independent core dependency graph."""

import subprocess
from pathlib import Path

manifest = Path(__file__).resolve().parents[1] / "Cargo.toml"
graph = subprocess.check_output(
    [
        "cargo",
        "tree",
        "--locked",
        "--manifest-path",
        str(manifest),
        "-p",
        "camera-path-core",
        "--edges",
        "normal",
        "--prefix",
        "none",
        "--format",
        "{p}",
    ],
    text=True,
)
forbidden = (
    "aws-sdk-",
    "aws-config ",
    "lapin ",
    "reqwest ",
    "axum ",
    "utoipa ",
    "camera-path-storage-",
    "camera-path-queue-",
    "camera-path-email-",
    "camera-path-openai ",
)
violations = sorted({line for line in graph.splitlines() if line.startswith(forbidden)})
if violations:
    raise SystemExit("Infrastructure dependencies in core:\n" + "\n".join(violations))
print(
    "Core dependency graph contains no provider SDKs, broker/HTTP clients or concrete adapters"
)
