"""Run the unchanged CP-118 contract suite against a built Rust executable."""

import os
import shlex
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
binary = Path(
    os.environ.get("CP_RUST_BINARY", root / "backend-rust/target/debug/camera-path")
)
if not binary.is_file():
    raise SystemExit(
        "Build the Rust backend first: cargo build --locked --manifest-path backend-rust/Cargo.toml"
    )
client = root / "integration/.venv/bin/python"
if not client.is_file():
    raise SystemExit(
        "Install the independent test client: uv sync --frozen --project integration"
    )
env = dict(os.environ)
env.update(
    {
        "CP_TEST_SERVER_COMMAND": shlex.join(
            [str(binary), "serve", "--host", "127.0.0.1", "--port", "{port}"]
        ),
        "CP_TEST_BOOTSTRAP_COMMAND": shlex.join([str(binary), "migrate"]),
        "CP_TEST_EDITOR_COMMAND": shlex.join([str(binary), "editor-create", "{email}"]),
    }
)
arguments = sys.argv[1:] or ["integration/tests", "--require-api-coverage"]
raise SystemExit(
    subprocess.call(
        [
            str(client),
            "-m",
            "pytest",
            "-c",
            "integration/pyproject.toml",
            "--tb=short",
            *arguments,
        ],
        env=env,
        cwd=root,
    )
)
