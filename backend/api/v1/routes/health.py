from fastapi import APIRouter
from fastapi.responses import JSONResponse
from core.config import get_settings
from schemas.common import ApiResponse
from schemas.health import HealthStatus

router = APIRouter()

@router.get("/health", response_model=ApiResponse[HealthStatus])
async def health() -> ApiResponse[HealthStatus]:
    return ApiResponse(data=HealthStatus(status="ok"))

@router.get("/ready")
async def ready() -> JSONResponse | dict[str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        return JSONResponse(status_code=503, content={"status": "not_ready", "checks": {"supabase_auth": "not_configured"}})
    return {"status": "ready", "checks": {"configuration": "ok"}}
