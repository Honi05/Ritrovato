"""Pickup bookings for office items (spec §1 "Status rules", §4)."""
import hashlib
import secrets
import sqlite3
from datetime import date

from fastapi import HTTPException

from . import office, office_db, office_hours

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_ACTIVE_PER_CONTACT = 2


def _h(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _code() -> str:
    return "RT-" + "".join(secrets.choice(ALPHABET) for _ in range(4))


def normalise_contact(contact: str) -> str:
    return " ".join(contact.split()).lower()


def check_day(d: date) -> None:
    first, last = office_hours.window()
    if not first <= d <= last:
        raise HTTPException(400, "bad_request: pick a day from tomorrow to 14 days ahead")


def slots(d: date) -> list[dict]:
    check_day(d)
    all_slots = office_hours.slots_for(d)
    with office_db.connect() as con:
        taken = {r[0] for r in con.execute(
            "SELECT slot_start FROM bookings WHERE status = 'booked' AND slot_start LIKE ?", (f"{d.isoformat()}T%",))}
    return [{"start": s, "free": s not in taken} for s in all_slots]


def book(public_item_id: str, name: str, contact: str, slot_start: str) -> dict:
    item_id = office.parse_id(public_item_id)
    if item_id is None or office.public_item(public_item_id) is None:
        raise HTTPException(404, "not_found: no such office item")
    if not office_hours.is_bookable(slot_start):
        raise HTTPException(400, "bad_request: not a bookable time")
    contact = normalise_contact(contact)
    token = secrets.token_urlsafe(32)
    with office_db.connect() as con:
        active = con.execute("SELECT count(*) FROM bookings WHERE contact = ? AND status = 'booked'",
                             (contact,)).fetchone()[0]
        if active >= MAX_ACTIVE_PER_CONTACT:
            raise HTTPException(429, "rate_limited: you already have 2 active bookings")
        status = con.execute("SELECT status FROM office_items WHERE id = ?", (item_id,)).fetchone()[0]
        if status != "available":
            raise HTTPException(409, "conflict: item_taken")
        for _ in range(5):
            code = _code()
            try:
                con.execute(
                    "INSERT INTO bookings (item_id, code, manage_token_hash, name, contact, slot_start, status, "
                    "created_at) VALUES (?,?,?,?,?,?, 'booked', ?)",
                    (item_id, code, _h(token), " ".join(name.split()), contact, slot_start, office_db.now()))
                break
            except sqlite3.IntegrityError as e:
                msg = str(e)
                if "bookings.code" in msg:
                    continue  # rare code collision, draw another
                if "slot_start" in msg:
                    raise HTTPException(409, "conflict: slot_taken") from None
                raise HTTPException(409, "conflict: item_taken") from None
        con.execute("UPDATE office_items SET status = 'reserved', updated_at = ? WHERE id = ?",
                    (office_db.now(), item_id))
    return {"code": code, "manage_token": token, "slot_start": slot_start, "item_id": public_item_id}


def _row_by_token(con, token: str):
    return con.execute("SELECT * FROM bookings WHERE manage_token_hash = ?", (_h(token),)).fetchone()


def _view(con, b) -> dict:
    item = con.execute("SELECT * FROM office_items WHERE id = ?", (b["item_id"],)).fetchone()
    return {"code": b["code"], "status": b["status"], "slot_start": b["slot_start"],
            "name": b["name"], "contact": b["contact"], "item": office.to_item(item)}


def by_token(token: str) -> dict | None:
    with office_db.connect() as con:
        b = _row_by_token(con, token)
        return _view(con, b) if b else None


def _close(con, b, status: str) -> None:
    con.execute("UPDATE bookings SET status = ? WHERE id = ?", (status, b["id"]))
    item_status = "returned" if status == "collected" else "available"
    con.execute("UPDATE office_items SET status = ?, updated_at = ? WHERE id = ? AND status = 'reserved'",
                (item_status, office_db.now(), b["item_id"]))


def cancel_by_token(token: str) -> dict:
    with office_db.connect() as con:
        b = _row_by_token(con, token)
        if b is None:
            raise HTTPException(404, "not_found: booking not found")
        if b["status"] != "booked":
            raise HTTPException(409, "conflict: booking is no longer active")
        _close(con, b, "cancelled")
        return _view(con, _row_by_token(con, token))


def _operator_view(con, b) -> dict:
    item = con.execute("SELECT * FROM office_items WHERE id = ?", (b["item_id"],)).fetchone()
    return {"id": b["id"], "code": b["code"], "status": b["status"], "slot_start": b["slot_start"],
            "name": b["name"], "contact": b["contact"], "item": office.operator_item(item)}


def day(d: date) -> list[dict]:
    with office_db.connect() as con:
        rows = con.execute("SELECT * FROM bookings WHERE slot_start LIKE ? ORDER BY slot_start, id",
                           (f"{d.isoformat()}T%",)).fetchall()
        return [_operator_view(con, b) for b in rows]


def set_status(booking_id: int, status: str) -> dict:
    with office_db.connect() as con:
        b = con.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if b is None:
            raise HTTPException(404, "not_found: booking not found")
        if b["status"] != "booked":
            raise HTTPException(409, "conflict: booking is no longer active")
        _close(con, b, status)
        b = con.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        return _operator_view(con, b)
