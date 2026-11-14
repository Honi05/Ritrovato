import logging
import struct
import zlib

import pytest
from fastapi.testclient import TestClient

from app import auth, booking, interpret, office, photo, photos
from app.main import app
from tests.test_office_items import draft, jpeg, new_item, op  # noqa: F401  (op is a fixture)


@pytest.fixture(autouse=True)
def operator():
    auth.create_operator("seed", "correct horse")


def add(**over):
    f = {"category": "id_document", "colour": None, "descr": "Carta d'identità Nr: CA12345AB",
         "found_place": "Termini", "found_at": "2026-11-10", "brand": None}
    return office.create({**f, **over}, 1)


def with_photo(item_id):
    from app import office_db
    with office_db.connect() as con:
        con.execute("UPDATE office_items SET photo_path = ? WHERE id = ?", ("a" * 32 + ".webp", item_id))


def test_office_public_descr_hides_numbers_operator_keeps_raw(op, monkeypatch):
    it = add(descr="Carta d'identità Nr: CA12345AB")
    with_photo(it["id"].split("-")[1])
    pub = office.public_item(it["id"])
    assert "12345" not in pub["descr"]
    assert pub["photo_url"] is None  # R3: sensitive categories have no public photo
    c = op
    assert "12345" not in c.get(f"/api/items/{it['id']}").json()["descr"]
    monkeypatch.setattr(interpret, "interpret", lambda t, l: {
        "category": "id_document", "brand": None, "keywords": [], "date_from": None, "date_to": None,
        "ignored": [], "colour": None, "place": None})
    res = c.post("/api/search", json={"query": "carta", "lang": "it"}).json()
    assert res["office"] and all("12345" not in o["descr"] for o in res["office"])
    row = c.get("/api/operator/items").json()["items"][0]
    assert row["descr"] == "Carta d'identità Nr: CA12345AB" and row["photo_url"] is not None


def test_office_keyword_with_digits_ignored(monkeypatch):
    add(category="wallet", descr="Portafoglio Nr: CA12345AB")
    from app import interpret as i
    monkeypatch.setattr(i, "interpret", lambda t, l: {
        "category": "wallet", "brand": None, "keywords": ["12345"], "date_from": None, "date_to": None,
        "ignored": [], "colour": None, "place": None})
    # digit keyword is skipped, so it neither matches nor excludes by itself
    assert office.browse("12345")["total"] == 1  # skipped keyword: no filtering on it
    assert office.browse("12345 zzzz")["total"] == 0
    # raw number must not be an oracle: a wrong number behaves exactly like the right one
    assert office.browse("99999")["total"] == office.browse("12345")["total"]


def test_non_sensitive_photo_stays_public():
    it = add(category="wallet", descr="Portafoglio nero")
    with_photo(it["id"].split("-")[1])
    assert office.public_item(it["id"])["photo_url"] is not None


def test_office_failure_does_not_break_registry(monkeypatch, caplog):
    def boom(*a, **k):
        raise RuntimeError("office db down")
    monkeypatch.setattr(office, "search", boom)
    monkeypatch.setattr(office, "browse", boom)
    c = TestClient(app)
    with caplog.at_level(logging.ERROR):
        r = c.post("/api/search", json={"query": "portafoglio", "lang": "it"})
        assert r.status_code == 200 and r.json()["office"] == [] and r.json()["total"] > 0
        r = c.get("/api/items", params={"q": ""})
        assert r.status_code == 200 and r.json()["office"] == [] and r.json()["total"] > 0
    assert "office search failed" in caplog.text


def png_header(w, h):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))


@pytest.mark.parametrize("size", [(7000, 7000), (12000, 12000)])
def test_huge_pixel_image_rejected(op, size):
    r = op.post("/api/operator/items/draft", files={"image": ("p.png", png_header(*size), "image/png")})
    assert r.status_code == 400


def test_draft_describe_gets_reencoded_webp(op, monkeypatch):
    seen = {}

    async def describe(data, ct):
        seen["data"], seen["ct"] = data, ct
        return None
    monkeypatch.setattr(photo, "describe", describe)
    original = jpeg()
    assert draft(op, original).status_code == 200
    assert seen["ct"] == "image/webp" and seen["data"][:4] == b"RIFF" and seen["data"] != original


def test_session_cookie_slides(op):
    r = op.get("/api/operator/me")
    assert r.status_code == 200
    sc = r.headers.get("set-cookie", "")
    assert "rt_op=" in sc and "Max-Age=43200" in sc and "HttpOnly" in sc


def test_book_item_taken_when_status_changed_between_check_and_update(monkeypatch):
    it = add(category="wallet", descr="Portafoglio nero")
    slot = _slot()
    real = office.public_item
    from app import office_db

    def stale(pid):  # simulate losing the race after the status check
        return real(pid)

    orig_connect = office_db.connect

    class Spy:
        def __init__(self):
            self.cm = orig_connect()

        def __enter__(self):
            self.con = self.cm.__enter__()
            return Wrapper(self.con)

        def __exit__(self, *a):
            return self.cm.__exit__(*a)

    class Wrapper:
        def __init__(self, con):
            self.con = con

        def execute(self, sql, *a):
            if sql.startswith("UPDATE office_items SET status = 'reserved'"):
                self.con.execute("UPDATE office_items SET status = 'discarded' WHERE id = ?", (a[0][1],))
            return self.con.execute(sql, *a)
    monkeypatch.setattr(office_db, "connect", lambda: Spy())
    with pytest.raises(Exception) as e:
        booking.book(it["id"], "Mario", "m@x.it", slot)
    assert getattr(e.value, "status_code", None) == 409 and "item_taken" in str(e.value.detail)


def _slot():
    from datetime import date, timedelta
    from app import office_hours
    d = date.today() + timedelta(days=1)
    for _ in range(14):
        s = office_hours.slots_for(d)
        if s:
            return s[0]
        d += timedelta(days=1)


def test_book_rejects_blank_name_or_contact():
    it = add(category="wallet", descr="Portafoglio nero")
    for name, contact in (("  ", "a@b.it"), ("Mario", "   ")):
        with pytest.raises(Exception) as e:
            booking.book(it["id"], name, contact, _slot())
        assert e.value.status_code == 400
