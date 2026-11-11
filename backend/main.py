"""Acadly FastAPI application entry point."""
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from api.errors import install_exception_handlers
from auth import AuthenticatedStudent, get_current_student
from api.v1.router import router as v1_router
from core.config import get_settings


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose declared body exceeds the configured limit."""

    def __init__(self, app, max_bytes: int) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        length = request.headers.get("content-length")
        if length:
            try:
                too_large = int(length) > self.max_bytes
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": "invalid_content_length",
                            "message": "Invalid request.",
                            "details": None,
                        }
                    },
                )
            if too_large:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "request_too_large",
                            "message": "Request body is too large.",
                            "details": None,
                        }
                    },
                )
        return await call_next(request)


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Acadly API",
        description=(
            "Versioned API for Acadly. "
            "Student-owned data remains protected by Supabase RLS."
        ),
        version="1.0.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
    )
    application.add_middleware(
        RequestSizeLimitMiddleware,
        max_bytes=settings.max_request_bytes,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )
    install_exception_handlers(application)
    application.include_router(v1_router, prefix="/api/v1")

    @application.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {"name": "Acadly API", "version": application.version}

    @application.get("/api/auth/me", tags=["auth"], include_in_schema=False)
    async def legacy_auth_me(
        student: Annotated[AuthenticatedStudent, Depends(get_current_student)],
    ) -> dict[str, str | None]:
        """Backward-compatible identity endpoint for existing clients."""
        return {"id": str(student.id), "email": student.email}

    @application.get("/api/health", tags=["meta"])
    async def legacy_health() -> dict[str, str]:
        """Compatibility liveness endpoint."""
        return {"status": "ok"}

    @application.get("/api/ready", tags=["meta"], response_model=None)
    async def legacy_readiness() -> JSONResponse | dict[str, str]:
        current = get_settings()
        if not current.supabase_url or not current.supabase_publishable_key:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "checks": {"supabase_auth": "not_configured"},
                },
            )
        return {"status": "ready", "checks": {"configuration": "ok"}}

    return application


app = create_app()
