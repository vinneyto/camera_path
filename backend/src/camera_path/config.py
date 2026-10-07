from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
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
    library_storage: Literal["local", "s3"] = "local"
    s3_bucket: str | None = Field(default=None, min_length=1)
    s3_prefix: str = "library/"
    s3_url_ttl_seconds: int = Field(default=300, ge=60, le=3600)
    aws_region: str | None = Field(default=None, validation_alias="AWS_REGION")
    aws_default_region: str | None = Field(default=None, validation_alias="AWS_DEFAULT_REGION")
    aws_profile: str | None = Field(default=None, validation_alias="AWS_PROFILE")
    aws_access_key_id: SecretStr | None = Field(default=None, validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: SecretStr | None = Field(
        default=None, validation_alias="AWS_SECRET_ACCESS_KEY"
    )
    aws_session_token: SecretStr | None = Field(default=None, validation_alias="AWS_SESSION_TOKEN")
    dev_user_id: str = Field(default="dev-user", min_length=1, max_length=128)
    jwt_secret: SecretStr | None = None
    jwt_ttl_seconds: int = Field(default=28800, ge=60, le=86400)

    @model_validator(mode="after")
    def validate_s3(self) -> "Settings":
        if self.library_storage == "s3" and not self.s3_bucket:
            raise ValueError("CAMERA_PATH_S3_BUCKET is required for S3 storage")
        if bool(self.aws_access_key_id) != bool(self.aws_secret_access_key):
            raise ValueError("Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        if not self.s3_prefix.endswith("/") or any(
            part in {"", ".", ".."} for part in self.s3_prefix.rstrip("/").split("/")
        ):
            raise ValueError("CAMERA_PATH_S3_PREFIX must be a non-empty prefix ending in /")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
