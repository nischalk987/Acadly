from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_root_returns_api_name() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "Acadly API"


def test_health_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
