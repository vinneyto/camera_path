from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CAMERA_PATH_", extra="ignore")

    openai_model: str = "gpt-5.6-luna"
    compile_tolerance: float = 1e-3


settings = Settings()
