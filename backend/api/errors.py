"""Consistent API errors; never expose sensitive exception details."""
import logging
from typing import Any
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

def error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}

def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        known = {
            400: ("bad_request", "The request could not be processed."),
            401: ("unauthorized", "Authentication is required."),
            403: ("forbidden", "You do not have permission to perform this action."),
            404: ("not_found", "The requested resource was not found."),
            413: ("request_too_large", "Request body is too large."),
            422: ("validation_error", "Request validation failed."),
            429: ("rate_limited", "Too many requests. Please try again later."),
        }
        code, message = known.get(exc.status_code, ("http_error", "The request could not be completed."))
        if exc.status_code == 401 and isinstance(exc.detail, str):
            message = exc.detail
        return JSONResponse(status_code=exc.status_code, content=error_payload(code, message), headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]} for item in exc.errors()]
        return JSONResponse(status_code=422, content=error_payload("validation_error", "Request validation failed.", details))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API exception", exc_info=exc)
        return JSONResponse(status_code=500, content=error_payload("internal_error", "An unexpected server error occurred."))
