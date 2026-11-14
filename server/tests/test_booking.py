import sqlite3
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import auth, booking, office, office_db, office_hours
from app.main import app

TODAY = date(2026, 11, 13)  # Friday → tomorrow Sat, next office day Mon 16 Nov


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(office_hours, "today", lambda: TODAY)


@pytest.fixture
def item():
    op = auth.create_operator("ana", "correct horse")
    return office.create({"category": "wallet", "colour": "black", "descr": "Portafoglio nero",
                          "found_place": "Termini", "found_at": "2026-11-10"}, op)["id"]


@pytest.fixture
def op():
    c = TestClient(app)
    c.post("/api/operator/login", json={"username": "ana", "password": "correct horse"})
    return c


def book(item_id, slot="2026-11-16T09:00", contact="ana@example.com", c=None):
    c = c or TestClient(app)
    return c.post(f"/api/office/items/{item_id}/book",
                  json={"name": "Ana Rossi", "contact": contact, "slot_start": slot, "ack": True})


def test_slots_follow_office_hours():
    assert office_hours.slots_for(date(2026, 11, 14)) == []  # Saturday
    mon = office_hours.slots_for(date(2026, 11, 16))
    assert mon[0] == "2026-11-16T08:30" and mon[-1] == "2026-11-16T12:45" and len(mon) == 18
    tue = office_hours.slots_for(date(2026, 11, 17))
    assert len(tue) == 18 + 8 and tue[-1] == "2026-11-17T16:15"


def test_slots_endpoint_and_window(item):
    c = TestClient(app)
    r = c.get("/api/office/slots", params={"date": "2026-11-16"}).json()
    assert r["date"] == "2026-11-16" and all(s["free"] for s in r["slots"])
    assert c.get("/api/office/slots", params={"date": "2026-11-13"}).status_code == 400  # today
    assert c.get("/api/office/slots", params={"date": "2026-11-28"}).status_code == 400  # > 14 days
    assert c.get("/api/office/slots", params={"date": "nope"}).status_code == 400


def test_book_happy_path_and_manage(item):
    r = book(item)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["code"].startswith("RT-") and len(b["code"]) == 7 and b["slot_start"] == "2026-11-16T09:00"
    c = TestClient(app)
    assert c.get(f"/api/items/{item}").json()["status"] == "reserved"
    slots = c.get("/api/office/slots", params={"date": "2026-11-16"}).json()["slots"]
    assert [s["free"] for s in slots if s["start"] == "2026-11-16T09:00"] == [False]
    m = c.get(f"/api/bookings/{b['manage_token']}").json()
    assert m["status"] == "booked" and m["item"]["id"] == item and m["name"] == "Ana Rossi"
    assert c.delete(f"/api/bookings/{b['manage_token']}").json()["status"] == "cancelled"
    assert c.get(f"/api/items/{item}").json()["status"] == "available"
    assert c.delete(f"/api/bookings/{b['manage_token']}").status_code == 409
    assert c.get("/api/bookings/not-a-token").status_code == 404


def test_public_item_never_shows_contact(item):
    book(item)
    body = TestClient(app).get(f"/api/items/{item}").text
    assert "ana@example.com" not in body and "Ana Rossi" not in body


@pytest.mark.parametrize("slot", ["2026-11-16T09:10", "2026-11-15T09:00", "2026-11-13T09:00",
                                  "2026-11-30T09:00", "2026-11-16T13:00", "garbage", "2026-11-16 09:00"])
def test_invalid_slots_rejected(item, slot):
    r = book(item, slot)
    assert r.status_code == 400 and r.json()["error"] == "bad_request"


def test_slot_and_item_conflicts(item):
    other = office.create({"category": "keys", "descr": "Chiavi", "found_place": "Bus 64",
                           "found_at": "2026-11-10"}, 1)["id"]
    assert book(item).status_code == 200
    r = book(other, contact="b@example.com")  # same slot
    assert r.status_code == 409 and "taken" in r.json()["message"]
    r = book(item, "2026-11-16T09:15", contact="c@example.com")  # same item
    assert r.status_code == 409


def test_concurrent_slot_is_unique_at_db_level(item):
    book(item)
    with pytest.raises(sqlite3.IntegrityError):
        with office_db.connect() as con:
            con.execute("INSERT INTO bookings (item_id, code, manage_token_hash, name, contact, slot_start, "
                        "status, created_at) VALUES (?, 'RT-ZZZZ', 'h', 'x', 'y', '2026-11-16T09:00', 'booked', 'now')",
                        (office.parse_id(item),))


def test_contact_limit_and_ip_limit(item):
    ids = [office.create({"category": "keys", "descr": f"Chiavi {i}", "found_place": "Bus",
                          "found_at": "2026-11-10"}, 1)["id"] for i in range(5)]
    assert book(item, "2026-11-16T09:00", "Same@Example.com ").status_code == 200
    assert book(ids[0], "2026-11-16T09:15", "same@example.com").status_code == 200
    r = book(ids[1], "2026-11-16T09:30", "same@example.com")
    assert r.status_code == 429
    codes = [book(ids[2], f"2026-11-17T{h}", f"x{h}@e.com").status_code for h in ("09:00", "09:15", "09:30")]
    assert codes[-1] == 429  # 5 per hour per IP (4 counted before: 3 attempts above + this loop)


def test_ack_required(item):
    r = TestClient(app).post(f"/api/office/items/{item}/book",
                             json={"name": "Ana", "contact": "a@e.com", "slot_start": "2026-11-16T09:00", "ack": False})
    assert r.status_code == 422


def test_unknown_item(item):
    assert book("office-999").status_code == 404
    assert book("2026-6741-495").status_code == 404


def test_operator_day_and_collect(item, op):
    b = book(item).json()
    day = op.get("/api/operator/bookings", params={"date": "2026-11-16"}).json()
    assert len(day) == 1 and day[0]["code"] == b["code"] and day[0]["contact"] == "ana@example.com"
    r = op.patch(f"/api/operator/bookings/{day[0]['id']}", json={"status": "collected"})
    assert r.json()["status"] == "collected"
    assert TestClient(app).get(f"/api/items/{item}").status_code == 404
    assert op.patch(f"/api/operator/bookings/{day[0]['id']}", json={"status": "no_show"}).status_code == 409


def test_no_show_frees_item(item, op):
    book(item)
    bid = op.get("/api/operator/bookings", params={"date": "2026-11-16"}).json()[0]["id"]
    op.patch(f"/api/operator/bookings/{bid}", json={"status": "no_show"})
    assert TestClient(app).get(f"/api/items/{item}").json()["status"] == "available"


def test_discard_cancels_booking(item, op):
    b = book(item).json()
    op.patch(f"/api/operator/items/{office.parse_id(item)}", json={"status": "discarded"})
    assert TestClient(app).get(f"/api/bookings/{b['manage_token']}").json()["status"] == "cancelled"


def test_returned_item_is_hidden(item, op):
    b = book(item).json()
    op.patch(f"/api/operator/items/{office.parse_id(item)}", json={"status": "returned"})
    c = TestClient(app)
    assert c.get(f"/api/items/{item}").status_code == 404
    assert c.get(f"/api/bookings/{b['manage_token']}").json()["status"] == "collected"


def test_operator_booking_routes_need_login():
    c = TestClient(app)
    assert c.get("/api/operator/bookings", params={"date": "2026-11-16"}).status_code == 401
    assert c.patch("/api/operator/bookings/1", json={"status": "collected"}).status_code == 401
