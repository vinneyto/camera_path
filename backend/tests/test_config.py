from pathlib import Path

import pytest

from camera_path.config import Settings


def test_openai_api_key_is_loaded_from_dotenv(monkeypatch, tmp_path) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("OPENAI_API_KEY=from-dotenv\n")

    settings = Settings(_env_file=env_file)

    assert settings.openai_api_key is not None
    assert settings.openai_api_key.get_secret_value() == "from-dotenv"


def test_default_database_url_preserves_previous_location(monkeypatch) -> None:
    monkeypatch.delenv("CAMERA_PATH_DATABASE_URL", raising=False)
    settings = Settings(_env_file=None)

    assert settings.database_url == (
        f"sqlite+aiosqlite:///{Path.home() / '.camera-path' / 'camera_path.sqlite3'}"
    )


@pytest.mark.parametrize(
    "field,standard",
    [
        ("aws_region", "AWS_REGION"),
        ("aws_default_region", "AWS_DEFAULT_REGION"),
        ("aws_profile", "AWS_PROFILE"),
    ],
)
def test_project_aws_settings_override_standard_fallback(field, standard, monkeypatch):
    project_key = f"CAMERA_PATH_{standard}"
    monkeypatch.delenv(project_key, raising=False)
    monkeypatch.setenv(standard, "fallback")
    assert getattr(Settings(_env_file=None), field) == "fallback"
    monkeypatch.setenv(project_key, "project")
    assert getattr(Settings(_env_file=None), field) == "project"
