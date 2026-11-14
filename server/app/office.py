"""Office-logged found items (spec §1, §2, §4)."""
import re
from datetime import date

from fastapi import HTTPException

from . import office_db, photos

CATEGORIES = ("wallet", "id_document", "payment_card", "bag", "phone", "other", "keys", "document_other",
              "electronics", "clothing", "glasses", "sim", "watch_jewelry", "money", "vehicle")
COLOURS = ("black", "white", "grey", "silver", "gold", "red", "orange", "yellow", "green", "blue",
           "purple", "pink", "brown", "beige", "multicolour")
PUBLIC_STATUSES = ("available", "reserved")
LIMITS = {"descr": (3, 500), "found_place": (2, 120)}
EDITABLE = ("category", "brand", "colour", "descr", "found_place", "found_at")


def public_id(n: int) -> str:
    return f"office-{n}"


def parse_id(s: str) -> int | None:
    m = re.fullmatch(r"office-(\d{1,9})", s or "")
    return int(m.group(1)) if m else None


def to_item(r) -> dict:
    """Public Item JSON (contract in docs/ARCHITECTURE.md)."""
    return {
        "id": public_id(r["id"]),
        "origin": "office",
        "year": int(r["found_at"][:4]),
        "reperto": None,
        "date": r["found_at"],
        "descr": r["descr"],
        "category": r["category"],
        "tags": [r["category"]],
        "brand": r["brand"],
        "number_guessed": False,
        "source": None,
        "colour": r["colour"],
        "found_place": r["found_place"],
        "photo_url": photos.url(r["photo_path"]),
        "status": r["status"] if r["status"] in PUBLIC_STATUSES else None,
    }


def operator_item(r) -> dict:
    return {**to_item(r), "status": r["status"], "created_at": r["created_at"], "updated_at": r["updated_at"]}


def _clean(fields: dict) -> dict:
    out = {}
    for k in EDITABLE:
        if k not in fields:
            continue
        v = fields[k]
        if v is None and k not in ("brand", "colour"):
            raise HTTPException(400, f"bad_request: {k} cannot be empty")
        if k == "category" and v not in CATEGORIES:
            raise HTTPException(400, "bad_request: unknown category")
        if k == "colour":
            v = v or None
            if v is not None and v not in COLOURS:
                raise HTTPException(400, "bad_request: unknown colour")
        if k == "brand":
            v = " ".join(v.upper().split()) if isinstance(v, str) and v.strip() else None
        if k in ("descr", "found_place"):
            v = " ".join(str(v).split())
            lo, hi = LIMITS[k]
            if not lo <= len(v) <= hi:
                raise HTTPException(400, f"bad_request: {k} must be {lo}-{hi} characters")
        if k == "found_at":
            v = str(v)
            try:
                d = date.fromisoformat(v)
            except ValueError:
                raise HTTPException(400, "bad_request: found_at must be yyyy-mm-dd") from None
            if d > date.today():
                raise HTTPException(400, "bad_request: found_at is in the future")
        out[k] = v
    return out


def get(item_id: int):
    with office_db.connect() as con:
        return con.execute("SELECT * FROM office_items WHERE id = ?", (item_id,)).fetchone()


def public_item(pid: str) -> dict | None:
    n = parse_id(pid)
    r = get(n) if n is not None else None
    return to_item(r) if r and r["status"] in PUBLIC_STATUSES else None


def create(fields: dict, operator_id: int) -> dict:
    clean = _clean(fields)
    photo = photos.promote(fields["draft_id"]) if fields.get("draft_id") else None
    now = office_db.now()
    with office_db.connect() as con:
        cur = con.execute(
            "INSERT INTO office_items (category, brand, colour, descr, found_place, found_at, photo_path, "
            "status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?, 'available', ?,?,?)",
            (clean["category"], clean.get("brand"), clean.get("colour"), clean["descr"], clean["found_place"],
             clean["found_at"], photo, operator_id, now, now))
        row = con.execute("SELECT * FROM office_items WHERE id = ?", (cur.lastrowid,)).fetchone()
    return operator_item(row)


def update(item_id: int, fields: dict) -> dict:
    if get(item_id) is None:
        raise HTTPException(404, "not_found: no such office item")
    clean = _clean(fields)
    if fields.get("draft_id"):
        clean["photo_path"] = photos.promote(fields["draft_id"])
    status = fields.get("status")
    with office_db.connect() as con:
        if clean:
            sets = ", ".join(f"{k} = ?" for k in clean)
            con.execute(f"UPDATE office_items SET {sets}, updated_at = ? WHERE id = ?",
                        [*clean.values(), office_db.now(), item_id])
        if status:
            close_booking = {"returned": "collected", "discarded": "cancelled"}[status]
            con.execute("UPDATE bookings SET status = ? WHERE item_id = ? AND status = 'booked'",
                        (close_booking, item_id))
            con.execute("UPDATE office_items SET status = ?, updated_at = ? WHERE id = ?",
                        (status, office_db.now(), item_id))
        row = con.execute("SELECT * FROM office_items WHERE id = ?", (item_id,)).fetchone()
    return operator_item(row)


def list_items(status=None, category=None, q="", limit=50, offset=0) -> dict:
    where, args = [], []
    if status:
        where.append("status = ?")
        args.append(status)
    if category:
        where.append("category = ?")
        args.append(category)
    for kw in q.split():
        where.append("(descr LIKE ? OR found_place LIKE ? OR IFNULL(brand,'') LIKE ?)")
        args += [f"%{kw}%"] * 3
    cond = " AND ".join(where) or "1"
    with office_db.connect() as con:
        total = con.execute(f"SELECT count(*) FROM office_items WHERE {cond}", args).fetchone()[0]
        rows = con.execute(f"SELECT * FROM office_items WHERE {cond} ORDER BY created_at DESC, id DESC "
                           "LIMIT ? OFFSET ?", [*args, limit, offset]).fetchall()
    return {"items": [operator_item(r) for r in rows], "total": total}
