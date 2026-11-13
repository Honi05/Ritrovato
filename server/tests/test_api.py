from fastapi.testclient import TestClient

from app import interpret as interpret_module
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"ok": True}


def test_meta():
    m = client.get("/api/meta").json()
    assert m["total"] > 10000 and m["last_item_date"] >= "2026-01-01" and m["categories"]


def test_items_filters():
    r = client.get("/api/items", params={"q": "samsung", "category": "phone", "date_from": "2026-01-01"}).json()
    assert r["total"] > 0 and r["interpreted"] is None
    for it in r["items"]:
        assert "SAMSUNG" in it["descr"].upper() and it["category"] == "phone" and it["date"] >= "2026-01-01"
        assert it["source"]["page"] > 0


def test_document_numbers_are_hidden():
    r = client.get("/api/items", params={"category": "id_document", "limit": 100}).json()
    assert r["items"] and not any("Nr:" in it["descr"] or "*" in it["descr"] for it in r["items"])


def test_search_fallback(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    def fail(*args, **kwargs):
        raise AssertionError("no network in tests")

    monkeypatch.setattr(interpret_module.httpx, "post", fail)
    assert client.post("/api/search", json={"query": "portafogli", "lang": "en"}).json()["total"] > 0


def test_errors_follow_contract():
    r = client.post("/api/search/photo", files={"image": ("a.gif", b"x", "image/gif")}, data={"lang": "it"})
    assert r.status_code == 400 and r.json()["error"] == "bad_request"
