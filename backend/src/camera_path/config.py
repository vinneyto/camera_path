import re
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATABASE_URL = f"sqlite+aiosqlite:///{Path.home() / '.camera-path' / 'camera_path.sqlite3'}"


class ImportSourceSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    driver: Literal["local", "s3"]
    root: str | None = None
    bucket: str | None = None
    prefix: str = ""

    @model_validator(mode="after")
    def validate_source(self):
        from camera_path.services.library_metadata import relative_key

        if self.driver == "local" and (not self.root or self.bucket or self.prefix):
            raise ValueError("Local import sources require only a root directory")
        if self.driver == "s3" and (not self.bucket or self.root):
            raise ValueError("S3 import sources require a bucket and optional prefix")
        if self.prefix:
            if not self.prefix.endswith("/"):
                raise ValueError("Source prefix must end in /")
            relative_key(self.prefix[:-1])
        return self


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CAMERA_PATH_", extra="ignore")

    openai_api_key: SecretStr | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_model: str = "gpt-5.6-luna"
    compile_tolerance: float = Field(default=1e-3, gt=0.0)
    database_url: str = DEFAULT_DATABASE_URL
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    library_directory: Path = Path.home() / ".camera-path" / "library"
    library_storage: Literal["local", "s3"] = Field(
        default="local", validation_alias="CAMERA_PATH_AWS_LIBRARY_STORAGE"
    )
    s3_bucket: str | None = Field(
        default=None, min_length=1, validation_alias="CAMERA_PATH_AWS_S3_BUCKET"
    )
    s3_prefix: str = Field(default="library/", validation_alias="CAMERA_PATH_AWS_S3_PREFIX")
    s3_url_ttl_seconds: int = Field(
        default=300, ge=60, le=3600, validation_alias="CAMERA_PATH_AWS_S3_URL_TTL_SECONDS"
    )
    aws_region: str | None = Field(
        default=None, validation_alias=AliasChoices("CAMERA_PATH_AWS_REGION", "AWS_REGION")
    )
    aws_default_region: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CAMERA_PATH_AWS_DEFAULT_REGION", "AWS_DEFAULT_REGION"),
    )
    aws_profile: str | None = Field(
        default=None, validation_alias=AliasChoices("CAMERA_PATH_AWS_PROFILE", "AWS_PROFILE")
    )
    aws_access_key_id: SecretStr | None = Field(default=None, validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: SecretStr | None = Field(
        default=None, validation_alias="AWS_SECRET_ACCESS_KEY"
    )
    aws_session_token: SecretStr | None = Field(default=None, validation_alias="AWS_SESSION_TOKEN")
    dev_user_id: str = Field(default="dev-user", min_length=1, max_length=128)
    jwt_secret: SecretStr | None = None
    environment: Literal["development", "production"] = "development"
    auth_second_factor: Literal["email", "off"] = "email"
    auth_email_delivery: Literal["smtp", "ses"] = "smtp"
    auth_email_from: str = "noreply@camerapath.dev"
    auth_smtp_host: Literal["localhost", "127.0.0.1", "::1"] = "127.0.0.1"
    auth_smtp_port: int = Field(default=1025, ge=1, le=65535)
    jwt_ttl_seconds: int = Field(default=28800, ge=60, le=86400)
    message_queue: Literal["none", "rabbitmq", "sqs"] = "none"
    rabbitmq_url: SecretStr = SecretStr("amqp://guest:guest@127.0.0.1:5672/")
    rabbitmq_queue: str = Field(
        default="camera-path.job-completions", pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$"
    )
    message_queue_max_attempts: int = Field(default=5, ge=1)
    message_queue_lease_seconds: int = Field(default=60, ge=1, le=43200)
    library_import_sources: dict[str, ImportSourceSettings] = Field(default_factory=dict)
    sqs_queue_url: str | None = Field(
        default=None, validation_alias="CAMERA_PATH_AWS_SQS_QUEUE_URL"
    )
    sqs_failure_queue_url: str | None = Field(
        default=None, validation_alias="CAMERA_PATH_AWS_SQS_FAILURE_QUEUE_URL"
    )

    @model_validator(mode="after")
    def validate_queue(self):
        if self.message_queue == "rabbitmq":
            url = urlsplit(self.rabbitmq_url.get_secret_value())
            if url.scheme not in {"amqp", "amqps"} or not url.hostname:
                raise ValueError("RabbitMQ requires an amqp/amqps URL")
        if self.message_queue == "sqs" and (
            not self.sqs_queue_url
            or not self.sqs_failure_queue_url
            or self.sqs_queue_url == self.sqs_failure_queue_url
        ):
            raise ValueError("SQS requires distinct input and failure queue URLs")
        if any(
            name == "library" or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", name)
            for name in self.library_import_sources
        ):
            raise ValueError("Invalid/reserved import source alias")
        return self

    @model_validator(mode="after")
    def validate_s3(self) -> "Settings":
        if self.library_storage == "s3" and not self.s3_bucket:
            raise ValueError("CAMERA_PATH_AWS_S3_BUCKET is required for S3 storage")
        if bool(self.aws_access_key_id) != bool(self.aws_secret_access_key):
            raise ValueError("Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        if not self.s3_prefix.endswith("/") or any(
            part in {"", ".", ".."} for part in self.s3_prefix.rstrip("/").split("/")
        ):
            raise ValueError("CAMERA_PATH_AWS_S3_PREFIX must be a non-empty prefix ending in /")
        return self

    @model_validator(mode="after")
    def validate_auth(self) -> "Settings":
        from camera_path.services.auth_email import normalize_email

        self.auth_email_from = normalize_email(self.auth_email_from)
        if self.environment == "production" and (
            self.auth_second_factor != "email" or self.auth_email_delivery != "ses"
        ):
            raise ValueError("Production requires email second factor with SES delivery")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
