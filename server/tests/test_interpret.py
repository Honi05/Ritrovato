import json as jsonlib

from fastapi.testclient import TestClient

from app import interpret as interpret_module
from app import main as main_module
from app.main import app


class FakeDeepSeekResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


def test_demo_query_mocked(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["body"] = json
        return FakeDeepSeekResponse({
            "choices": [{
                "message": {
                    "content": jsonlib.dumps({
                        "category": "phone",
                        "brand": "samsung",
                        "keywords": ["telefono"],
                        "date_from": "2026-10-01",
                        "date_to": "2026-10-31",
                        "ignored": ["colour", "black"],
                    })
                }
            }]
        })

    monkeypatch.setattr(interpret_module.httpx, "post", fake_post)

    result = interpret_module.interpret("I lost my black Samsung phone in October", "en")

    assert result["category"] == "phone"
    assert result["brand"] == "SAMSUNG"
    assert result["keywords"] == ["TELEFONO"]
    assert result["date_from"] == "2026-10-01"
    assert result["date_to"] == "2026-10-31"
    assert "colour" in result["ignored"]

    body = captured["body"]
    prompt = body["messages"][0]["content"]
    assert "json" in prompt.lower()
    assert "phone" in prompt
    assert body["response_format"] == {"type": "json_object"}


def test_fallback_without_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    def fail(*args, **kwargs):
        raise AssertionError("DeepSeek should not be called without a key")

    monkeypatch.setattr(interpret_module.httpx, "post", fail)

    assert interpret_module.interpret("Samsung phone", "en") is None


def test_search_route_fallback_without_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    def fail(*args, **kwargs):
        raise AssertionError("DeepSeek should not be called without a key")

    monkeypatch.setattr(interpret_module.httpx, "post", fail)

    client = TestClient(app)
    response = client.post("/api/search", json={"query": "Samsung phone in October", "lang": "en"})

    assert response.status_code == 200
    data = response.json()
    assert data["interpreted"] is None
    assert data["items"] is not None
    assert data["total"] > 0


def test_search_route_fallback_without_key_maps_phone(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    def fail(*args, **kwargs):
        raise AssertionError("DeepSeek should not be called without a key")

    monkeypatch.setattr(interpret_module.httpx, "post", fail)

    client = TestClient(app)
    response = client.post(
        "/api/search",
        json={"query": "I lost my black Samsung phone in October", "lang": "en"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["interpreted"] is None
    assert data["total"] > 0
    assert all(item["category"] == "phone" for item in data["items"])


def test_search_relaxation_path(monkeypatch):
    def fake_interpret(text, lang):
        return {
            "category": "wallet",
            "brand": "XYZ",
            "keywords": ["NONEXISTENT"],
            "date_from": "2099-01-01",
            "date_to": "2099-12-31",
            "ignored": [],
        }

    monkeypatch.setattr(main_module.interpret, "interpret", fake_interpret)

    client = TestClient(app)
    response = client.post("/api/search", json={"query": "wallet", "lang": "it"})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    assert "relaxed" not in data
    assert data["interpreted"]["brand"] == "XYZ"
