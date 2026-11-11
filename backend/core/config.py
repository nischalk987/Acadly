"""Validated backend configuration."""
from functools import lru_cache
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "development"
    cors_origins: str = "http://127.0.0.1:5173"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    max_request_bytes: int = Field(default=1_048_576, ge=1_024, le=10_485_760)
    supabase_auth_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("supabase_url")
    @classmethod
    def normalize_supabase_url(cls, value: str) -> str:
        return value.strip().rstrip("/")

    @property
    def allowed_origins(self) -> list[str]:
        origins = [item.strip().rstrip("/") for item in self.cors_origins.split(",") if item.strip()]
        if not origins or "*" in origins:
            raise ValueError("CORS_ORIGINS must contain explicit origins; wildcard origins are forbidden.")
        return origins

@lru_cache
def get_settings() -> Settings:
    return Settings()
