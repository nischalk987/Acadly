from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_v1_health_contract() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"data": {"status": "ok"}}


def test_protected_route_rejects_missing_token() -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    assert response.headers["www-authenticate"] == "Bearer"


def test_versioned_openapi_contract() -> None:
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["version"] == "1.0.0"
    assert "/api/v1/auth/me" in spec["paths"]
    assert "HTTPBearer" in spec["components"]["securitySchemes"]


def test_readiness_without_supabase_config(monkeypatch) -> None:
    from core.config import get_settings

    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "")
    get_settings.cache_clear()
    response = client.get("/api/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    get_settings.cache_clear()
