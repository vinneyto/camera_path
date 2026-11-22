import importlib.util
import sys
from pathlib import Path

import pytest
from dotenv import dotenv_values


@pytest.mark.parametrize(
    "configured,expected",
    [
        ("# CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=[180,0,0]\n", "[180,0,0]"),
        ("CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=\n", "[180,0,0]"),
        ("CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=[0,90,0]\n", "[0,90,0]"),
    ],
)
def test_dev_setup_writes_active_rotation_and_preserves_custom_settings(
    tmp_path, monkeypatch, configured, expected
):
    source = Path(__file__).resolve().parents[2] / "scripts/dev.py"
    spec = importlib.util.spec_from_file_location("dev_setup_test", source)
    dev = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dev)
    monkeypatch.delenv("CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG", raising=False)
    for folder in ("backend", "frontend"):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / ".env.example").write_text(configured if folder == "backend" else "")
    monkeypatch.setattr(dev, "ROOT", tmp_path)
    for key in ("BACKEND", "FRONTEND"):
        monkeypatch.setattr(dev, key, tmp_path / key.lower())
    monkeypatch.setattr(dev, "BACKEND_ENV", tmp_path / "backend/.env")
    backend_example = tmp_path / "backend/.env.example"
    with backend_example.open("a") as stream:
        stream.write(
            "CAMERA_PATH_MESSAGE_QUEUE=rabbitmq\n"
            "CAMERA_PATH_RABBITMQ_QUEUE=old-clone-queue\n"
            "CAMERA_PATH_PAINTER_OUTPUT_DIRECTORY=old-output\n"
            "CAMERA_PATH_IMAGE_GENERATION_PROVIDER=openai\n"
        )
    dev.configure_env()
    dev.configure_env()
    assert dotenv_values(dev.BACKEND_ENV)["CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG"] == expected
    assert any(
        line.startswith("CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=")
        for line in dev.BACKEND_ENV.read_text().splitlines()
    )

    backend = dotenv_values(dev.BACKEND_ENV)
    assert backend["CAMERA_PATH_MESSAGE_QUEUE"] == "none"
    assert backend["CAMERA_PATH_IMAGE_GENERATION_PROVIDER"] == "openai"
    assert backend.keys().isdisjoint(dev.LEGACY_AMQP_SETTINGS)

    monkeypatch.setattr(dev, "require", lambda *commands: None)
    monkeypatch.setenv("CAMERA_PATH_DEV_FRONTEND_PORT", "3019")
    monkeypatch.setenv("CAMERA_PATH_DEV_BACKEND_PORT", "8019")
    monkeypatch.delenv("CAMERA_PATH_CLI_WEB_URL", raising=False)
    monkeypatch.delenv("CAMERA_PATH_CLI_DEV_WEB_URL", raising=False)
    monkeypatch.delenv("CAMERA_PATH_CLI_DEV_API_URL", raising=False)
    backend_dir, backend_env, backend_command = dev.service_command("backend")
    assert backend_dir == dev.BACKEND
    assert backend_env["CAMERA_PATH_CLI_WEB_URL"] == "http://127.0.0.1:3019"
    assert backend_command[:3] == [sys.executable, "-m", "uvicorn"]
    assert backend_command[-1] == "8019"

    worker_dir, worker_env, worker_command = dev.service_command("inference")
    assert worker_dir == dev.ROOT
    assert worker_env["CAMERA_PATH_CLI_DEV_WEB_URL"] == "http://127.0.0.1:3019"
    assert worker_env["CAMERA_PATH_CLI_DEV_API_URL"] == "http://127.0.0.1:8019"
    assert worker_command == [
        "uv",
        "run",
        "--project",
        "cli",
        "camera-path",
        "--profile",
        "dev",
        "worker",
    ]
