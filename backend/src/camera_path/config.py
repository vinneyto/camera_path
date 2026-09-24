from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATABASE_PATH = Path.home() / ".camera-path" / "camera_path.sqlite3"
DEFAULT_DATABASE_URL = f"sqlite+aiosqlite:///{DEFAULT_DATABASE_PATH}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CAMERA_PATH_", extra="ignore")

    openai_api_key: SecretStr | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_model: str = "gpt-5.6-luna"
    compile_tolerance: float = Field(default=1e-3, gt=0.0)
    database_url: str = DEFAULT_DATABASE_URL
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    library_directory: Path = Path.home() / ".camera-path" / "library"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
