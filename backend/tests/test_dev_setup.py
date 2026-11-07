import importlib.util
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
    for folder in ("backend", "frontend", "generation"):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / ".env.example").write_text(configured if folder == "backend" else "")
    monkeypatch.setattr(dev, "ROOT", tmp_path)
    for key in ("BACKEND", "FRONTEND", "GENERATION"):
        monkeypatch.setattr(dev, key, tmp_path / key.lower())
    monkeypatch.setattr(dev, "BACKEND_ENV", tmp_path / "backend/.env")
    monkeypatch.setattr(dev, "GENERATION_ENV", tmp_path / "generation/.env")
    dev.configure_env()
    dev.configure_env()
    assert dotenv_values(dev.BACKEND_ENV)["CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG"] == expected
    assert any(
        line.startswith("CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=")
        for line in dev.BACKEND_ENV.read_text().splitlines()
    )
