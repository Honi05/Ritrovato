"""Office back-office storage (spec §1): operators, sessions, office items, bookings.

A separate SQLite file next to the registry DB, so the registry seed in Git and the
daily update are never touched (D-015)."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from . import db

PATH = Path(os.environ.get("OFFICE_DB_PATH", db.DB_PATH.parent / "office.sqlite"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS operators (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS office_items (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  brand TEXT,
  colour TEXT,
  descr TEXT NOT NULL,
  found_place TEXT NOT NULL,
  found_at TEXT NOT NULL,
  photo_path TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_by INTEGER NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES office_items(id),
  code TEXT UNIQUE NOT NULL,
  manage_token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  slot_start TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_booking_per_slot ON bookings(slot_start) WHERE status = 'booked';
CREATE UNIQUE INDEX IF NOT EXISTS one_booking_per_item ON bookings(item_id) WHERE status = 'booked';
"""

_ready: set[str] = set()


def connect() -> sqlite3.Connection:
    """Like db.connect(); `with connect() as con:` commits on success, rolls back on error."""
    path = Path(PATH)
    if str(path) not in _ready:
        path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    if str(path) not in _ready:
        con.executescript(SCHEMA)
        _ready.add(str(path))
    return con


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
