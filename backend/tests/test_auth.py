from uuid import UUID

import httpx
from fastapi.testclient import TestClient

import auth
from main import app

client = TestClient(app)


def mock_auth_response(monkeypatch, status_code: int, payload: dict) -> list[httpx.Request]:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(status_code, json=payload)

    real_client = httpx.AsyncClient

    def client_with_mock_transport(**kwargs):
        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(auth.httpx, "AsyncClient", client_with_mock_transport)
    monkeypatch.setenv("SUPABASE_URL", "https://acadly-test.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")
    auth.get_settings.cache_clear()
    return requests


def test_auth_me_requires_bearer_token() -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_auth_me_validates_token_with_supabase(monkeypatch) -> None:
    user_id = "d8d2a2bd-0cd1-4ff8-83c5-95a2f86101d7"
    requests = mock_auth_response(
        monkeypatch,
        200,
        {"id": user_id, "email": "student@example.com", "user_metadata": {"user_id": "attacker"}},
    )

    response = client.get("/api/auth/me", headers={"Authorization": "Bearer signed-access-token"})

    assert response.status_code == 200
    assert response.json() == {"data": {"id": user_id, "email": "student@example.com"}}
    assert len(requests) == 1
    assert str(requests[0].url) == "https://acadly-test.supabase.co/auth/v1/user"
    assert requests[0].headers["authorization"] == "Bearer signed-access-token"
    assert requests[0].headers["apikey"] == "test-publishable-key"


def test_auth_me_rejects_token_supabase_does_not_accept(monkeypatch) -> None:
    mock_auth_response(monkeypatch, 401, {"message": "invalid token"})
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer forged-token"})
    assert response.status_code == 401


def test_auth_me_returns_503_when_server_auth_is_not_configured(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "")
    auth.get_settings.cache_clear()
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer any-token"})
    assert response.status_code == 503


def test_auth_identity_is_a_uuid(monkeypatch) -> None:
    user_id = "d8d2a2bd-0cd1-4ff8-83c5-95a2f86101d7"
    mock_auth_response(monkeypatch, 200, {"id": user_id})
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == 200
    assert UUID(response.json()["data"]["id"]) == UUID(user_id)


def test_auth_rejects_malformed_identity_from_auth_service(monkeypatch) -> None:
    mock_auth_response(monkeypatch, 200, {"id": "not-a-uuid"})
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == 401
