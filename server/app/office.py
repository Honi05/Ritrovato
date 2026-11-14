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


def _candidates(category, brand, date_from, date_to, statuses=PUBLIC_STATUSES):
    where = [f"status IN ({','.join('?' * len(statuses))})"]
    args: list = list(statuses)
    if category:
        where.append("category = ?")
        args.append(category)
    if brand:
        where.append("brand = ? COLLATE NOCASE")
        args.append(brand)
    if date_from:
        where.append("found_at >= ?")
        args.append(date_from)
    if date_to:
        where.append("found_at <= ?")
        args.append(date_to)
    with office_db.connect() as con:
        return con.execute(f"SELECT * FROM office_items WHERE {' AND '.join(where)}", args).fetchall()


def _score(r, keywords, colour, place) -> int | None:
    """None = excluded (keywords given but none matches)."""
    hay = f"{r['descr']} {r['brand'] or ''} {r['found_place']}".lower()
    hits = sum(1 for k in keywords if k.lower() in hay)
    if keywords and not hits:
        return None
    score = hits
    if colour and r["colour"] == colour:
        score += 2
    if place and any(w.lower() in r["found_place"].lower() for w in place.split() if len(w) >= 3):
        score += 1
    return score


def _match(f: dict) -> list:
    scored = []
    for r in _candidates(f.get("category"), f.get("brand"), f.get("date_from"), f.get("date_to")):
        s = _score(r, f.get("keywords") or [], f.get("colour"), f.get("place"))
        if s is not None:
            scored.append((r["status"] == "reserved", -s, r["found_at"], r["id"], r))
    # available before reserved, then score desc, then newest found, then newest id
    scored.sort(key=lambda t: (t[0], t[1], _neg(t[2]), -t[3]))
    return [t[4] for t in scored]


def _neg(iso: str) -> str:
    # sort ISO dates descending inside an ascending sort key
    return "".join(chr(0x7F - ord(c)) for c in iso)


def search(filters: dict, limit: int = 6) -> list[dict]:
    """Office matches for an Interpreted filter set; relaxes keywords → brand → dates, never category."""
    f = dict(filters)
    for drop in ((), ("keywords",), ("brand",), ("date_from", "date_to")):
        for k in drop:
            f[k] = [] if k == "keywords" else None
        rows = _match(f)
        if rows:
            return [to_item(r) for r in rows[:limit]]
    return []


def browse(q="", category=None, brand=None, date_from=None, date_to=None, limit=20, offset=0) -> dict:
    """Catalogue filters over office items; every q word must occur (like the registry)."""
    rows = [r for r in _candidates(category, brand, date_from, date_to)
            if all(k.lower() in f"{r['descr']} {r['brand'] or ''} {r['found_place']}".lower() for k in q.split())]
    rows.sort(key=lambda r: (r["status"] == "reserved", _neg(r["found_at"]), -r["id"]))
    return {"items": [to_item(r) for r in rows[offset:offset + limit]], "total": len(rows)}
