from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

from auth import AuthenticatedStudent, get_current_student


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_env: str = "development"
    cors_origins: str = "http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        if not origins or "*" in origins:
            raise ValueError(
                "CORS_ORIGINS must contain explicit origins; wildcard origins are forbidden."
            )
        return origins


settings = Settings()

app = FastAPI(
    title="Acadly API",
    description="Backend API for the free student study-management platform.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"name": "Acadly API", "environment": settings.app_env}


@app.get("/api/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/me", tags=["auth"])
async def auth_me(
    student: Annotated[AuthenticatedStudent, Depends(get_current_student)],
) -> dict[str, str | None]:
    """Return the authenticated student's canonical identity."""

    return {"id": str(student.id), "email": student.email}
