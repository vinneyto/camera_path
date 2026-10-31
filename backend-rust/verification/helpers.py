"""Reuse CP-118's unchanged real-process/SMTP harness for migration and provider checks."""

import importlib.util
import os
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "integration/tests"))
spec = importlib.util.spec_from_file_location(
    "cp118_harness", ROOT / "integration/tests/conftest.py"
)
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
Backend = harness.Backend
RUST = Path(os.environ.get("CP_RUST_BINARY", ROOT / "backend-rust/target/debug/camera-path"))
PYTHON = Path(os.environ.get("CP_PYTHON_BIN", ROOT / "backend/.venv/bin/python"))


def command(backend, implementation):
    if implementation == "rust":
        return [str(RUST), "serve", "--host", "127.0.0.1", "--port", str(backend.port)]
    return [
        str(PYTHON),
        "-m",
        "uvicorn",
        "camera_path.api:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(backend.port),
    ]


def migration(backend):
    return subprocess.run(
        [str(RUST), "migrate"],
        cwd=backend.directory,
        env=backend.env,
        capture_output=True,
        text=True,
        timeout=30,
    )


@contextmanager
def running(directory, implementation="rust", extra_env=None):
    backend = Backend(directory)
    backend.command = command(backend, implementation)
    if extra_env:
        backend.env.update(extra_env)
    if implementation == "rust":
        backend.bootstrap = [str(RUST), "migrate"]
        backend.editor_command = [str(RUST), "editor-create", backend.email]
    else:
        config = directory / "legacy-alembic.ini"
        config.write_text(
            (ROOT / "backend/alembic.ini")
            .read_text()
            .replace("script_location = alembic", f"script_location = {ROOT / 'backend/alembic'}")
        )
        backend.bootstrap = [str(PYTHON), "-m", "alembic", "-c", str(config), "upgrade", "head"]
        backend.editor_command = [str(PYTHON.parent / "editor-create"), backend.email]
    try:
        backend.setup()
        yield backend
    finally:
        backend.close()


def upload(backend):
    data = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"
    pending = backend.request(
        "POST",
        "/api/v1/library/uploads",
        201,
        json={"name": "Persisted asset", "size_bytes": len(data)},
    ).json()
    backend.request("PUT", pending["upload_url"], 204, content=data)
    asset = backend.request("POST", f"/api/v1/library/{pending['id']}/complete").json()
    return asset, data
