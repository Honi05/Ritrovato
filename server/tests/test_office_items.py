import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import auth, office, photo, photos
from app import interpret as interpret_module
from app.main import app


def jpeg(w=2400, h=1600, exif_gps=True, colour=(20, 20, 20)) -> bytes:
    img = Image.new("RGB", (w, h), colour)
    buf = io.BytesIO()
    exif = Image.Exif()
    if exif_gps:
        exif[0x8825] = {1: "N", 2: (41.0, 54.0, 0.0)}  # GPSInfo
    exif[0x0112] = 6  # orientation: rotate 90°
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


@pytest.fixture
def op():
    auth.create_operator("ana", "correct horse")
    c = TestClient(app)
    c.post("/api/operator/login", json={"username": "ana", "password": "correct horse"})
    return c


def draft(c, data=None, ct="image/jpeg"):
    return c.post("/api/operator/items/draft", files={"image": ("p.jpg", data or jpeg(), ct)})


def new_item(c, **over):
    d = draft(c).json()
    body = {"draft_id": d["draft_id"], "category": "wallet", "brand": None, "colour": "black",
            "descr": "Portafoglio in pelle nero", "found_place": "Termini, binario 4", "found_at": "2026-11-10"}
    return c.post("/api/operator/items", json={**body, **over})


def test_operator_routes_need_login():
    c = TestClient(app)
    for method, path in [("post", "/api/operator/items/draft"), ("post", "/api/operator/items"),
                         ("patch", "/api/operator/items/1"), ("get", "/api/operator/items")]:
        assert getattr(c, method)(path).status_code == 401, path


def test_draft_reencodes_strips_exif_and_rotates(op, monkeypatch):
    async def no_ai(data, ct):
        raise RuntimeError("offline")
    monkeypatch.setattr(photo, "describe", no_ai)
    r = draft(op)
    assert r.status_code == 200
    body = r.json()
    assert body["suggested"] is None and len(body["draft_id"]) == 32
    saved = Image.open(photos.DIR / "drafts" / f"{body['draft_id']}.webp")
    assert saved.format == "WEBP" and max(saved.size) <= 1200
    assert saved.size[1] > saved.size[0]  # 2400x1600 rotated by orientation 6 -> portrait
    assert not saved.getexif()


def test_draft_rejects_bad_files(op):
    assert draft(op, b"not an image").status_code == 400
    assert draft(op, b"x", "image/gif").status_code == 400
    assert draft(op, b"\xff" * (8 * 1024 * 1024 + 1)).status_code == 413


def test_draft_suggestions(op, monkeypatch):
    async def describe(data, ct):
        return "Portafoglio nero in pelle"
    monkeypatch.setattr(photo, "describe", describe)
    monkeypatch.setattr(interpret_module, "interpret", lambda text, lang: {
        "category": "wallet", "brand": None, "colour": "black", "keywords": [], "date_from": None,
        "date_to": None, "ignored": [], "place": None})
    s = draft(op).json()["suggested"]
    assert s == {"category": "wallet", "brand": None, "colour": "black", "descr": "Portafoglio nero in pelle"}


def test_create_and_public_item(op):
    r = new_item(op)
    assert r.status_code == 200, r.text
    it = r.json()
    assert it["id"].startswith("office-") and it["origin"] == "office" and it["status"] == "available"
    assert it["photo_url"].startswith("/api/photos/") and it["source"] is None and it["reperto"] is None
    assert TestClient(app).get(it["photo_url"]).headers["content-type"] == "image/webp"
    pub = TestClient(app).get(f"/api/items/{it['id']}").json()
    assert pub["found_place"] == "Termini, binario 4" and pub["colour"] == "black" and pub["year"] == 2026
    assert "created_by" not in pub


def test_create_validation(op):
    assert new_item(op, category="spaceship").status_code == 400
    assert new_item(op, colour="teal").status_code == 400
    assert new_item(op, found_at="2999-01-01").status_code == 400
    assert new_item(op, descr="x").status_code == 422
    assert op.post("/api/operator/items", json={"draft_id": "0" * 32, "category": "wallet", "descr": "abc",
                                                "found_place": "Termini", "found_at": "2026-11-10"}).status_code == 400


def test_item_without_photo(op):
    r = op.post("/api/operator/items", json={"category": "keys", "descr": "Mazzo di chiavi",
                                             "found_place": "Bus 64", "found_at": "2026-11-12"})
    assert r.status_code == 200 and r.json()["photo_url"] is None


def test_patch_and_list(op):
    it = new_item(op).json()
    n = it["id"].split("-")[1]
    r = op.patch(f"/api/operator/items/{n}", json={"brand": "gucci", "found_place": "Colosseo"})
    assert r.json()["brand"] == "GUCCI" and r.json()["found_place"] == "Colosseo"
    op.patch(f"/api/operator/items/{n}", json={"status": "discarded"})
    assert TestClient(app).get(f"/api/items/{it['id']}").status_code == 404
    lst = op.get("/api/operator/items", params={"status": "discarded"}).json()
    assert lst["total"] == 1 and lst["items"][0]["status"] == "discarded"
    assert op.get("/api/operator/items", params={"q": "pelle"}).json()["total"] == 1
    assert op.patch("/api/operator/items/999", json={"brand": "x"}).status_code == 404


def test_photo_path_traversal_blocked():
    c = TestClient(app)
    assert c.get("/api/photos/..%2Foffice.sqlite").status_code == 404
    assert c.get("/api/photos/drafts").status_code == 404


def test_purge_old_drafts(op, monkeypatch):
    async def no_ai(data, ct):
        return None
    monkeypatch.setattr(photo, "describe", no_ai)
    draft(op)
    assert photos.purge_drafts(max_age=-1) == 1


def test_seed_demo_is_idempotent():
    from app import operators
    assert operators.seed_demo("demo-pass-123") == 8
    assert operators.seed_demo("demo-pass-123") == 0
    c = TestClient(app)
    assert c.post("/api/operator/login", json={"username": "demo", "password": "demo-pass-123"}).status_code == 200


def test_blank_and_null_text_fields_rejected(op):
    it = new_item(op).json()
    n = it["id"].split("-")[1]
    for body in ({"descr": None}, {"found_place": "  "}, {"descr": "   "}, {"category": None}, {"found_at": None}):
        assert op.patch(f"/api/operator/items/{n}", json=body).status_code == 400, body
    lst = op.get("/api/operator/items").json()["items"][0]
    assert lst["descr"] == it["descr"] and lst["found_place"] == it["found_place"]
    assert new_item(op, descr="   ").status_code == 400
