from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)

VOICE_FILE = {"audio": ("a.webm", b"audio", "audio/webm")}
PHOTO_FILE = {"image": ("keys.jpg", b"image", "image/jpeg")}


def test_voice_success(monkeypatch):
    seen = {}

    def fake_transcribe(data, filename, content_type):
        assert content_type == "audio/webm"
        return "portafogli"

    def fake_search(text, lang):
        seen["text"] = text
        seen["lang"] = lang
        return {"items": [], "total": 0, "interpreted": None}

    monkeypatch.setattr(main.voice, "transcribe", fake_transcribe)
    monkeypatch.setattr(main.interpret, "search", fake_search)

    r = client.post("/api/search/voice", files=VOICE_FILE, data={"lang": "it"})
    assert r.status_code == 200
    body = r.json()
    assert body["transcript"] == "portafogli"
    assert body["items"] == []
    assert body["interpreted"] is None
    assert seen == {"text": "portafogli", "lang": "it"}


def test_photo_success(monkeypatch):
    seen = {}

    async def fake_describe(data, content_type):
        assert content_type == "image/jpeg"
        return "Portachiavi Wikimedia"

    def fake_search(text, lang):
        seen["text"] = text
        seen["lang"] = lang
        return {"items": [], "total": 0, "interpreted": None}

    monkeypatch.setattr(main.photo, "describe", fake_describe)
    monkeypatch.setattr(main.interpret, "search", fake_search)

    r = client.post("/api/search/photo", files=PHOTO_FILE, data={"lang": "it"})
    assert r.status_code == 200
    body = r.json()
    assert body["description"] == "Portachiavi Wikimedia"
    assert body["items"] == []
    assert seen == {"text": "Portachiavi Wikimedia", "lang": "it"}


def test_voice_empty_transcript_returns_no_items(monkeypatch):
    monkeypatch.setattr(main.voice, "transcribe", lambda data, filename, content_type: "")

    def not_called(*args, **kwargs):
        raise AssertionError("interpret.search should not be called for empty transcript")

    monkeypatch.setattr(main.interpret, "search", not_called)

    r = client.post("/api/search/voice", files=VOICE_FILE, data={"lang": "it"})
    assert r.status_code == 200
    body = r.json()
    assert body["transcript"] == ""
    assert body["items"] == []
    assert body["interpreted"] is None


def test_photo_nessun_oggetto_returns_none_description(monkeypatch):
    async def fake_describe(data, content_type):
        return None

    monkeypatch.setattr(main.photo, "describe", fake_describe)

    def not_called(*args, **kwargs):
        raise AssertionError("interpret.search should not be called for NESSUN OGGETTO")

    monkeypatch.setattr(main.interpret, "search", not_called)

    r = client.post("/api/search/photo", files=PHOTO_FILE, data={"lang": "it"})
    assert r.status_code == 200
    body = r.json()
    assert body["description"] is None
    assert body["items"] == []


def test_voice_too_large_returns_413():
    r = client.post(
        "/api/search/voice",
        files={"audio": ("a.webm", b"x" * (10 * 1024 * 1024 + 1), "audio/webm")},
        data={"lang": "it"},
    )
    assert r.status_code == 413
    assert r.json()["error"] == "too_large"


def test_photo_too_large_returns_413():
    r = client.post(
        "/api/search/photo",
        files={"image": ("keys.jpg", b"x" * (8 * 1024 * 1024 + 1), "image/jpeg")},
        data={"lang": "it"},
    )
    assert r.status_code == 413
    assert r.json()["error"] == "too_large"


def test_photo_bad_content_type_returns_400():
    r = client.post(
        "/api/search/photo",
        files={"image": ("keys.gif", b"image", "image/gif")},
        data={"lang": "it"},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "bad_request"


def test_voice_upstream_error_returns_502(monkeypatch):
    def fail(data, filename, content_type):
        raise RuntimeError("boom")

    monkeypatch.setattr(main.voice, "transcribe", fail)
    r = client.post("/api/search/voice", files=VOICE_FILE, data={"lang": "it"})
    assert r.status_code == 502
    assert r.json()["error"] == "upstream_failed"


def test_photo_upstream_error_returns_502(monkeypatch):
    async def fail(data, content_type):
        raise RuntimeError("boom")

    monkeypatch.setattr(main.photo, "describe", fail)
    r = client.post("/api/search/photo", files=PHOTO_FILE, data={"lang": "it"})
    assert r.status_code == 502
    assert r.json()["error"] == "upstream_failed"


def test_paid_quota_returns_429(monkeypatch):
    from app import main as m
    monkeypatch.setattr(m, "PAID_PER_IP", 2)
    m._hits.clear()
    monkeypatch.setattr(m.voice, "transcribe", lambda *a, **k: "")
    c = TestClient(m.app)
    codes = [c.post("/api/search/voice", files={"audio": ("a.webm", b"x", "audio/webm")},
                    data={"lang": "it"}, headers={"cf-connecting-ip": "9.9.9.9"}).status_code
             for _ in range(3)]
    assert codes == [200, 200, 429]
    r = c.post("/api/search/voice", files={"audio": ("a.webm", b"x", "audio/webm")},
               data={"lang": "it"}, headers={"cf-connecting-ip": "8.8.8.8"})
    assert r.status_code == 200  # other clients unaffected
    m._hits.clear()
