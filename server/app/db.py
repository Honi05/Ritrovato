"""Read access to the lost-items catalogue (SQLite, table `oggetti`). Schema: docs/DATA.md."""
import os
import re
import shutil
import sqlite3
from pathlib import Path

SEED = Path(__file__).parent.parent / "seed" / "oggetti.sqlite"
DB_PATH = Path(os.environ.get("DB_PATH", SEED))
SOURCE_URL = "https://www.comune.roma.it/web/it/scheda-servizi.page?contentId=INF39645"

# Registry dates are dd/mm/yyyy text; this makes them comparable.
ISO = "substr(date,7,4)||'-'||substr(date,4,2)||'-'||substr(date,1,2)"


def init():
    """First start with an empty volume: copy the seed DB shipped in the image."""
    if not DB_PATH.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(SEED, DB_PATH)


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


# shortcut: regex + token filter catches labelled numbers (also OCR-garbled labels) and any
# token with 3+ digits; upgrade to cleaning at ingest time and review leftovers before going public.
_NUMBERS = re.compile(r"\s*-?\s*\b(?:Nr|N|Nº|N°|NUM|EV|IMEI)\s*[:.].*?(?=\s+-\s+|$)")


def public_descr(descr):
    """Registry text without partial document/card/IMEI numbers (D-011)."""
    words = _NUMBERS.sub("", descr).split()
    return " ".join(w for w in words if "*" not in w and len(re.findall(r"\d", w)) < 3).strip(" -")


def _item(r):
    return {
        "id": f"{r['year']}-{r['reperto']}-{r['page']}",
        "year": r["year"],
        "reperto": r["reperto"],
        "date": r["iso"],
        "descr": public_descr(r["descr"]),
        "category": r["category"],
        "tags": r["tags"].split(",") if r["tags"] else [],
        "brand": r["brand"] or None,
        "number_guessed": bool(r["num_guessed"]),
        "source": {"page": r["page"], "url": SOURCE_URL},
        "origin": "registry",
        "colour": None,
        "found_place": None,
        "photo_url": None,
        "status": None,
    }


def search(keywords=(), category=None, brand=None, date_from=None, date_to=None, limit=20, offset=0):
    """All filters are AND-ed; every keyword must occur in the description."""
    where, args = [], []
    for kw in keywords:
        if re.search(r"\d{4}", kw):  # never match on document numbers (D-011)
            continue
        where.append("descr LIKE ?")
        args.append(f"%{kw}%")
    for col, val in (("category", category), ("brand", brand)):
        if val:
            where.append(f"{col} = ? COLLATE NOCASE")
            args.append(val)
    if date_from:
        where.append(f"{ISO} >= ?")
        args.append(date_from)
    if date_to:
        where.append(f"{ISO} <= ?")
        args.append(date_to)
    cond = " AND ".join(where) or "1"
    with connect() as con:
        total = con.execute(f"SELECT count(*) FROM oggetti WHERE {cond}", args).fetchone()[0]
        rows = con.execute(
            f"SELECT *, {ISO} AS iso FROM oggetti WHERE {cond} ORDER BY iso DESC, reperto DESC LIMIT ? OFFSET ?",
            [*args, limit, offset],
        ).fetchall()
    return {"items": [_item(r) for r in rows], "total": total}


def item(item_id: str):
    """One entry by its id `<year>-<reperto>-<page>`, or None."""
    try:
        year, reperto, page = (int(p) for p in item_id.split("-"))
    except ValueError:
        return None
    with connect() as con:
        r = con.execute(f"SELECT *, {ISO} AS iso FROM oggetti WHERE year=? AND reperto=? AND page=?",
                        (year, reperto, page)).fetchone()
    return _item(r) if r else None


def meta():
    with connect() as con:
        total, last = con.execute(f"SELECT count(*), max({ISO}) FROM oggetti").fetchone()
        cats = con.execute("SELECT category, count(*) FROM oggetti GROUP BY 1 ORDER BY 2 DESC").fetchall()
        try:  # table `meta` is created by the daily updater (block 06)
            kv = dict(con.execute("SELECT key, value FROM meta").fetchall())
        except sqlite3.OperationalError:
            kv = {}
    return {
        "total": total,
        "last_item_date": last,
        "last_checked_at": kv.get("last_checked_at"),
        "new_items_last_check": int(kv.get("new_items_last_check", 0)),
        "categories": [{"id": c, "count": n} for c, n in cats],
        "source_url": SOURCE_URL,
    }
