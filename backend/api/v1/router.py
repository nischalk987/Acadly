from fastapi import APIRouter
from api.v1.routes.auth import router as auth_router
from api.v1.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router, tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
