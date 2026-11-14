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


def test_relaxation_drops_one_keyword_at_a_time(monkeypatch):
    monkeypatch.setattr(main_module.interpret, "interpret", lambda t, l: {
        "category": "wallet", "brand": None, "keywords": ["INTESA", "NONEXISTENT"],
        "date_from": None, "date_to": None, "ignored": []})
    data = TestClient(app).post("/api/search", json={"query": "x", "lang": "it"}).json()
    assert 0 < data["total"] < 1000  # INTESA kept, only the bad word dropped
    assert all("INTESA" in i["descr"] for i in data["items"])


def test_agent_first_then_deepseek(monkeypatch):
    agent_answer = {"category": "phone", "brand": "SAMSUNG", "keywords": [],
                    "date_from": None, "date_to": None, "ignored": []}
    calls = []
    monkeypatch.setattr(interpret_module, "_request_filter_agent",
                        lambda t, l: calls.append("agent") or agent_answer)
    monkeypatch.setattr(interpret_module, "_request_filter",
                        lambda t, l: calls.append("deepseek") or {"category": "wallet"})
    assert interpret_module.interpret("x", "it")["category"] == "phone"
    assert calls == ["agent"]

    calls.clear()
    monkeypatch.setattr(interpret_module, "_request_filter_agent",
                        lambda t, l: calls.append("agent") or None)
    assert interpret_module.interpret("x", "it")["category"] == "wallet"
    assert calls == ["agent", "deepseek"]


def _phone_samsung(date_from, date_to):
    return {"category": "phone", "brand": "SAMSUNG", "keywords": [], "date_from": date_from,
            "date_to": date_to, "ignored": []}


def test_search_reports_relaxed_filters(monkeypatch):
    monkeypatch.setattr(interpret_module, "interpret",
                        lambda text, lang: {**_phone_samsung("2031-01-01", "2031-01-31"), "brand": None})
    body = TestClient(app).post("/api/search", json={"query": "phone 2031", "lang": "en"}).json()
    assert body["total"] > 0
    assert body["interpreted"]["relaxed"] == ["dates"]


def test_search_reports_nothing_relaxed(monkeypatch):
    monkeypatch.setattr(interpret_module, "interpret", lambda text, lang: _phone_samsung(None, None))
    body = TestClient(app).post("/api/search", json={"query": "samsung", "lang": "en"}).json()
    assert body["total"] > 0
    assert body["interpreted"]["relaxed"] == []


def test_search_caches_interpretation(monkeypatch):
    calls = []
    monkeypatch.setattr(interpret_module, "interpret",
                        lambda text, lang: calls.append(text) or _phone_samsung(None, None))
    client = TestClient(app)
    for q in ("Samsung", " samsung "):
        client.post("/api/search", json={"query": q, "lang": "en"})
    assert len(calls) == 1


def test_search_does_not_cache_failures(monkeypatch):
    calls = []
    monkeypatch.setattr(interpret_module, "interpret", lambda text, lang: calls.append(text))
    client = TestClient(app)
    for _ in range(2):
        client.post("/api/search", json={"query": "samsung", "lang": "en"})
    assert len(calls) == 2


def test_text_search_rate_limited(monkeypatch):
    monkeypatch.setattr(main_module, "TEXT_PER_IP", 2)
    client = TestClient(app)
    codes = [client.post("/api/search", json={"query": "chiavi", "lang": "it"}).status_code
             for _ in range(3)]
    assert codes == [200, 200, 429]
