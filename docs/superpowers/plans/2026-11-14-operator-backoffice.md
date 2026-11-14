# Operator Back-office and Pickup Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Office staff log found items (photo, AI pre-filled fields, place, date) in a back-office; citizens find them in the existing search and book a 15-minute pickup slot.

**Architecture:** New backend modules beside the registry code (`office_db`, `auth`, `photos`, `office_hours`, `office`, `booking`, two FastAPI routers) storing data in a separate SQLite file `office.sqlite` next to the registry DB. Search responses gain an `office` list; registry `items`/`total` stay unchanged. Frontend adds public office components, a booking flow and an operator area under `#/operator/...` in the same React app.

**Tech Stack:** FastAPI + SQLite + Pillow + argon2-cffi + tzdata (server, Python 3.13); React 19 + TypeScript + Tailwind 4 + Vite (web); pytest; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-operator-backoffice-design.md`

## Deviations from the spec (decided while planning)

1. **Separate SQLite file** `office.sqlite` (env `OFFICE_DB_PATH`, default next to `DB_PATH`) instead of the registry file. Reason: tests and local dev point `DB_PATH` at the seed in Git; writing tables there would dirty the seed. Behaviour is identical.
2. **Photos served at `/api/photos/<name>`**, not `/photos/...`: the Vite dev proxy only forwards `/api`.
3. **Draft endpoint has no IP limit**: it requires an operator session; the shared photo limiter lives in `main.py` and importing it from a router is circular.
4. **Demo photos are generated** by `seed-demo` with Pillow (coloured card + label), not bundled stock photos.
5. **PATCH item status `returned`** marks an active booking `collected`; `discarded` cancels it.

## Global Constraints

- All code, identifiers, comments, commits in English. UI: public strings in it, en, es, fr, de; operator strings in it, en (others fall back to en).
- Error body is always `{"error": "<code>", "message": "<text>"}`; raise `HTTPException(status, "<code>: <message>")` — `main.http_error` splits it. Codes: `bad_request` 400, `unauthorized` 401, `not_found` 404, `conflict` 409, `too_large` 413, `rate_limited` 429, `upstream_failed` 502.
- Never send to a public endpoint, log or the browser: password hashes, token hashes, citizen `name`/`contact` (except to the manage-token holder and operators).
- Categories (exact ids): `wallet, id_document, payment_card, bag, phone, other, keys, document_other, electronics, clothing, glasses, sim, watch_jewelry, money, vehicle`.
- Colours (exact ids): `black, white, grey, silver, gold, red, orange, yellow, green, blue, purple, pink, brown, beige, multicolour`.
- Item status: `available | reserved | returned | discarded`. Booking status: `booked | collected | no_show | cancelled`.
- Slots: 15 min, capacity 1, Europe/Rome local, format `YYYY-MM-DDTHH:MM`, bookable from tomorrow to today+14. Default hours Mon–Fri 08:30–13:00, Tue/Thu also 14:30–16:30; env `OFFICE_HOURS_JSON` overrides.
- Limits: login 10 / 10 min per IP; booking 5 / hour per IP; ≤ 2 `booked` bookings per normalised contact; photos jpeg/png/webp ≤ 8 MB → WebP ≤ 1200 px, EXIF stripped.
- Session cookie `rt_op`: HttpOnly, SameSite=Lax, Secure when the request came over HTTPS, 12 h sliding.
- No browser dialogs (`alert/confirm/prompt`) — confirmations are in-page.
- Existing tests must keep passing: `cd server && .venv/Scripts/python.exe -m pytest -q` (baseline 34 passed, 1 skipped) and `cd web && npm run build && npm run lint`.
- Python deps are installed with `uv pip install --python .venv/Scripts/python.exe <pkg>` from `server/`; pin the installed version in `requirements.txt`.
- Do not `git push`. Commit on `feat/operators` only.

## Review Focus

1. **Two citizens book the same slot or item at the same moment** → exactly one succeeds, the other gets 409 with `slot_taken` / `item_taken` message; enforced by partial unique indexes (Task 4 test `test_concurrent_slot_is_unique_at_db_level`).
2. **Operator's session expires mid-intake** → the API answers 401 and the UI sends them to login rather than silently losing the save (Task 2 test `test_expired_session_is_401`; Task 7 `OperatorApp` redirects on any 401).
3. **Photo with EXIF GPS / rotated phone photo / huge or corrupt file** → stored WebP has no EXIF, upright orientation, ≤ 1200 px; corrupt → 400, > 8 MB → 413 (Task 3 tests).
4. **Item discarded or returned while a citizen holds a booking** → booking is closed (cancelled / collected), the manage page shows the new status, the item leaves public search and `GET /api/items/office-N` returns 404 (Task 4 tests `test_discard_cancels_booking`, `test_returned_item_is_hidden`).
5. **Slot strings that are almost right** (`2026-11-15T09:10`, a Sunday, today, 15 days ahead, garbage) → 400 `bad_request`, never stored (Task 4 test `test_invalid_slots_rejected`).

---

## File map

Server (`server/app/`):

| File | Responsibility |
|---|---|
| `office_db.py` (new) | Path, schema, `connect()`, `now()` |
| `ratelimit.py` (new) | `Limiter` class, `client_ip()`, `LOGIN`, `BOOKING` instances |
| `auth.py` (new) | Password hashing, operators, sessions, `current_operator` dependency |
| `photos.py` (new) | Validate + re-encode uploads, drafts, promote, purge, url |
| `office_hours.py` (new) | Office hours, booking window, slot lists, slot validation |
| `office.py` (new) | Office item CRUD, public item JSON, office search and browse |
| `booking.py` (new) | Slots with availability, book, manage-token view/cancel, operator status changes |
| `operator_api.py` (new) | Router `/api/operator/*` |
| `office_api.py` (new) | Router `/api/office/*`, `/api/bookings/*`, `/api/photos/*` |
| `operators.py` (new) | CLI: `create-admin`, `seed-demo` |
| `db.py` (modify) | Registry item JSON gains `origin` + null office fields |
| `interpret.py` (modify) | `colour`/`place` in Interpreted; `search()` returns `office` |
| `main.py` (modify) | Include routers, init office DB, purge thread, office ids, `source=office`, `office` field everywhere |
| `tests/conftest.py` (modify) | Temp office DB + photos dir + limiter reset per test |

Web (`web/src/`):

| File | Responsibility |
|---|---|
| `api.ts` (modify) | Types + fetch helpers for everything new |
| `lib/router.ts` (modify) | `booking` and `operator` routes |
| `lib/colours.ts` (new) | Colour ids + swatch hex |
| `lib/ics.ts` (new) | `.ics` file for a booking |
| `components/OfficeCard.tsx`, `components/OfficeStrip.tsx` (new) | Office result card + strip |
| `components/BookingPanel.tsx` (new) | Day → time → details → confirm, plus confirmation screen |
| `pages/OfficeItemPage.tsx`, `pages/ManageBooking.tsx` (new) | Public office item page, manage page |
| `pages/ItemPage.tsx`, `pages/Search.tsx`, `pages/Catalogue.tsx`, `pages/Home.tsx`, `components/ItemTag.tsx`, `components/Understood.tsx`, `App.tsx` (modify) | Integration |
| `i18n/{en,it,es,fr,de}.ts` (modify) | Public strings |
| `operator/*` (new) | `OperatorApp`, `strings.ts`, `Login`, `Today`, `Intake`, `ItemForm`, `Inventory`, `Bookings`, `BookingRow` |
| `e2e/operator.spec.ts` (new) | End-to-end story |

---

### Task 1: Contract docs and decision record

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/DECISIONS.md`, `docs/OPERATIONS.md`, `.gitignore`

**Interfaces:**
- Produces: the written contract every later task implements (copy of spec §2 with the deviations above).

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**

  - In "Components" table, Backend row: append ", office back-office and pickup booking".
  - In "Layout" add lines:
    ```
    server/app/office_db.py   office.sqlite: operators, sessions, office_items, bookings
    server/app/auth.py        operator passwords and sessions
    server/app/photos.py      office photo uploads (WebP, EXIF stripped)
    server/app/office_hours.py pickup slots
    server/app/office.py      office items, office search
    server/app/booking.py     pickup bookings
    server/app/operator_api.py /api/operator/*
    server/app/office_api.py  /api/office/*, /api/bookings/*, /api/photos/*
    server/app/operators.py   CLI: create-admin, seed-demo
    web/src/operator/         back-office screens
    ```
  - In "API contract" intro add codes `unauthorized` (401) and `conflict` (409).
  - Replace the `Item` example with the spec's (field `origin`, `source` nullable, `colour`, `found_place`, `photo_url`, `status`) and state: registry items have `origin: "registry"` and the four office fields `null`.
  - `Interpreted`: add `"colour": "black"` (fixed set listed in Global Constraints, or null) and `"place": "Termini"` (or null).
  - `SearchResponse`: add `"office": [Item]` — ≤ 6 office matches; `items`/`total` stay registry-only.
  - `GET /api/items/{id}`: also `office-<n>` (404 unless available/reserved).
  - `GET /api/items`: new query `source=office` → office items only, paged in `items`; without it `office` holds ≤ 6 matching office items on `offset=0`, `[]` otherwise.
  - Add sections for every endpoint of spec §2 "Public endpoints" and "Operator endpoints" (copy the tables), with photos at `GET /api/photos/{name}`.
  - "Data": add `office.sqlite` (env `OFFICE_DB_PATH`, default next to `DB_PATH`) and photos dir (env `PHOTOS_DIR`, default `<office db dir>/photos`); "Uploaded audio and photos are processed in memory and never stored" → "Search audio and photos are processed in memory and never stored; office photos uploaded by operators are stored as WebP without EXIF."

- [ ] **Step 2: `docs/PRODUCT.md`** — in "Out of MVP — not doing", replace "Sign-up and accounts; claiming an item online." with "Citizen accounts; online ownership claims (pickup booking for office-logged items exists since D-015, ownership is checked at the desk)." Add a section before "Demo script":

  ```markdown
  ## Office back-office (post-hackathon, D-015)

  Staff log found items with a photo; the photo agent pre-fills category, brand, colour and
  description. These items carry colour, place and photo, appear in every search as
  "Found at the office", and can be booked for a 15-minute pickup slot. Spec:
  `docs/superpowers/specs/2026-11-14-operator-backoffice-design.md`.
  ```

- [ ] **Step 3: `docs/DECISIONS.md`** — append:

  ```markdown
  ## D-015 · 2026-11-14 · Office back-office with pickup booking

  Staff-logged items live in a separate `office.sqlite` (registry seed and daily update
  untouched) and are returned in a separate `office` list in search responses, so registry
  paging, relaxation and tests do not change. Citizens book a slot; no online ownership
  claim, no emails. Spec: `docs/superpowers/specs/2026-11-14-operator-backoffice-design.md`.
  ```

- [ ] **Step 4: `docs/OPERATIONS.md`** — add to the env/secrets section: `OFFICE_DB_PATH` (optional), `PHOTOS_DIR` (optional), `OFFICE_HOURS_JSON` (optional, e.g. `{"0":[["08:30","13:00"]]}`, keys are weekday 0=Mon), and "First operator: `docker compose exec app python -m app.operators create-admin <username>`". (Read the file first; put it where env vars are listed.)

- [ ] **Step 5: `.gitignore`** — add lines `server/seed/office.sqlite` and `server/seed/photos/` (local dev defaults land next to the seed).

- [ ] **Step 6: Commit**

```bash
git add docs/ARCHITECTURE.md docs/PRODUCT.md docs/DECISIONS.md docs/OPERATIONS.md .gitignore
git commit -m "docs: contract for office back-office and pickup booking (D-015)"
```

---

### Task 2: Office DB, rate limiter, operator auth, login API

**Files:**
- Create: `server/app/office_db.py`, `server/app/ratelimit.py`, `server/app/auth.py`, `server/app/operator_api.py`, `server/tests/test_auth.py`
- Modify: `server/app/main.py`, `server/tests/conftest.py`, `server/requirements.txt`

**Interfaces:**
- Produces:
  - `office_db.PATH: Path`, `office_db.connect() -> sqlite3.Connection` (row_factory Row, FK on, schema ensured), `office_db.now() -> str` (UTC ISO seconds, e.g. `2026-11-14T15:00:00+00:00`)
  - `ratelimit.Limiter(limit: int, window: float)` with `.hit(key: str) -> bool`, `.clear()`; `ratelimit.client_ip(request) -> str`; instances `ratelimit.LOGIN` (10/600 s), `ratelimit.BOOKING` (5/3600 s); `ratelimit.ALL: list[Limiter]`
  - `auth.create_operator(username: str, password: str, display_name: str | None = None, is_admin: bool = False) -> int`
  - `auth.set_password(username: str, password: str) -> None`
  - `auth.current_operator(request: Request) -> dict` — FastAPI dependency returning `{"id", "username", "display_name", "is_admin"}` or raising 401
  - `operator_api.router: APIRouter` (prefix `/api/operator`)

- [ ] **Step 1: Add dependencies**

```bash
cd server && uv pip install --python .venv/Scripts/python.exe argon2-cffi Pillow tzdata
.venv/Scripts/python.exe -m pip show argon2-cffi Pillow tzdata 2>/dev/null | grep -E "^(Name|Version)" || uv pip list --python .venv/Scripts/python.exe | grep -iE "argon2-cffi|pillow|tzdata"
```
Append the three pinned lines (`argon2-cffi==<ver>`, `Pillow==<ver>`, `tzdata==<ver>`) to `server/requirements.txt`.

- [ ] **Step 2: Test fixtures** — add to `server/tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
def office_tmp(tmp_path, monkeypatch):
    # Office data never touches the repo: temp DB and photo dir per test.
    from app import office_db, photos, ratelimit
    monkeypatch.setattr(office_db, "PATH", tmp_path / "office.sqlite")
    monkeypatch.setattr(photos, "DIR", tmp_path / "photos")
    for limiter in ratelimit.ALL:
        limiter.clear()
    yield
```
Note: `photos` does not exist until Task 3. In this task create a minimal `server/app/photos.py` containing only:
```python
"""Office photo uploads (spec §1 "Photos")."""
import os
from pathlib import Path

from . import office_db

DIR = Path(os.environ.get("PHOTOS_DIR", office_db.PATH.parent / "photos"))
```

- [ ] **Step 3: Write failing tests** `server/tests/test_auth.py`:

```python
from fastapi.testclient import TestClient

from app import auth, office_db
from app.main import app


def client():
    return TestClient(app)


def login(c, username="ana", password="correct horse"):
    return c.post("/api/operator/login", json={"username": username, "password": password})


def test_login_me_logout():
    auth.create_operator("ana", "correct horse", "Ana")
    c = client()
    r = login(c)
    assert r.status_code == 200 and r.json() == {"username": "ana", "display_name": "Ana", "is_admin": False}
    cookie = r.headers["set-cookie"].lower()
    assert "rt_op=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert c.get("/api/operator/me").json()["username"] == "ana"
    assert c.post("/api/operator/logout").status_code == 200
    r = c.get("/api/operator/me")
    assert r.status_code == 401 and r.json()["error"] == "unauthorized"


def test_wrong_password_and_unknown_user_look_the_same():
    auth.create_operator("ana", "correct horse")
    a, b = login(client(), password="nope"), login(client(), username="ghost")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_password_is_hashed():
    auth.create_operator("ana", "correct horse")
    with office_db.connect() as con:
        h = con.execute("select password_hash from operators").fetchone()[0]
    assert h.startswith("$argon2") and "correct horse" not in h


def test_login_rate_limited():
    auth.create_operator("ana", "correct horse")
    c = client()
    codes = [login(c, password="bad").status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_expired_session_is_401():
    auth.create_operator("ana", "correct horse")
    c = client()
    login(c)
    with office_db.connect() as con:
        con.execute("update sessions set expires_at = '2000-01-01T00:00:00+00:00'")
    assert c.get("/api/operator/me").status_code == 401


def test_secure_cookie_behind_https():
    auth.create_operator("ana", "correct horse")
    r = client().post("/api/operator/login", json={"username": "ana", "password": "correct horse"},
                      headers={"x-forwarded-proto": "https"})
    assert "secure" in r.headers["set-cookie"].lower()


def test_duplicate_username_rejected():
    auth.create_operator("ana", "correct horse")
    import pytest
    with pytest.raises(ValueError):
        auth.create_operator("ana", "other password")
```

- [ ] **Step 4: Run** `cd server && .venv/Scripts/python.exe -m pytest tests/test_auth.py -q` — expected: FAIL (`ImportError: cannot import name 'auth'`).

- [ ] **Step 5: Implement `server/app/office_db.py`**

```python
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
```

- [ ] **Step 6: Implement `server/app/ratelimit.py`**

```python
"""Small in-memory sliding-window limiters for the office endpoints."""
import threading
import time
from collections import defaultdict, deque

from fastapi import Request


class Limiter:
    def __init__(self, limit: int, window: float):
        self.limit, self.window = limit, window
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> bool:
        """Record one attempt; False when the key is over the limit."""
        now = time.time()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True

    def clear(self):
        with self._lock:
            self._hits.clear()


def client_ip(request: Request) -> str:
    # Behind Cloudflare (see main._quota); falls back to the socket peer locally.
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")


LOGIN = Limiter(10, 600)
BOOKING = Limiter(5, 3600)
ALL = [LOGIN, BOOKING]
```

- [ ] **Step 7: Implement `server/app/auth.py`**

```python
"""Operator accounts and cookie sessions (spec §2 "Operator endpoints")."""
import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException, Request

from . import office_db

COOKIE = "rt_op"
TTL = timedelta(hours=12)
_ph = PasswordHasher()
_DUMMY = _ph.hash("timing-equaliser")  # unknown users cost the same as wrong passwords


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _expiry() -> str:
    return (datetime.now(timezone.utc) + TTL).isoformat(timespec="seconds")


def create_operator(username: str, password: str, display_name: str | None = None, is_admin: bool = False) -> int:
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    try:
        with office_db.connect() as con:
            cur = con.execute(
                "INSERT INTO operators (username, password_hash, display_name, is_admin, created_at) VALUES (?,?,?,?,?)",
                (username, _ph.hash(password), display_name or username, int(is_admin), office_db.now()),
            )
            return cur.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError(f"operator {username!r} already exists") from None


def set_password(username: str, password: str) -> None:
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    with office_db.connect() as con:
        con.execute("UPDATE operators SET password_hash = ? WHERE username = ?", (_ph.hash(password), username))
        con.execute("DELETE FROM sessions WHERE operator_id = (SELECT id FROM operators WHERE username = ?)", (username,))


def verify(username: str, password: str) -> sqlite3.Row | None:
    with office_db.connect() as con:
        row = con.execute("SELECT * FROM operators WHERE username = ?", (username,)).fetchone()
    try:
        _ph.verify(row["password_hash"] if row else _DUMMY, password)
    except (VerificationError, InvalidHashError):
        return None
    return row


def new_session(operator_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with office_db.connect() as con:
        con.execute("DELETE FROM sessions WHERE expires_at < ?", (office_db.now(),))
        con.execute("INSERT INTO sessions (token_hash, operator_id, expires_at) VALUES (?,?,?)",
                    (_hash_token(token), operator_id, _expiry()))
    return token


def end_session(token: str | None) -> None:
    if token:
        with office_db.connect() as con:
            con.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def public(row) -> dict:
    return {"username": row["username"], "display_name": row["display_name"], "is_admin": bool(row["is_admin"])}


def current_operator(request: Request) -> dict:
    """Dependency for every /api/operator/* route except login; slides the expiry."""
    token = request.cookies.get(COOKIE)
    if token:
        h = _hash_token(token)
        with office_db.connect() as con:
            row = con.execute(
                "SELECT o.* FROM sessions s JOIN operators o ON o.id = s.operator_id "
                "WHERE s.token_hash = ? AND s.expires_at > ?", (h, office_db.now())).fetchone()
            if row:
                con.execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", (_expiry(), h))
                return {"id": row["id"], **public(row)}
    raise HTTPException(401, "unauthorized: log in first")


def is_https(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https" \
        or '"scheme":"https"' in request.headers.get("cf-visitor", "")
```

- [ ] **Step 8: Implement `server/app/operator_api.py`** (later tasks append routes)

```python
"""Back-office API: /api/operator/* (spec §2). Every route except login needs a session."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from . import auth, ratelimit

router = APIRouter(prefix="/api/operator")
Operator = Depends(auth.current_operator)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


@router.post("/login")
def login(req: LoginRequest, request: Request, response: Response):
    if not ratelimit.LOGIN.hit(ratelimit.client_ip(request)):
        raise HTTPException(429, "rate_limited: too many login attempts, wait 10 minutes")
    row = auth.verify(req.username, req.password)
    if row is None:
        raise HTTPException(401, "unauthorized: wrong username or password")
    token = auth.new_session(row["id"])
    response.set_cookie(auth.COOKIE, token, max_age=int(auth.TTL.total_seconds()), httponly=True,
                        samesite="lax", secure=auth.is_https(request), path="/")
    return auth.public(row)


@router.post("/logout")
def logout(request: Request, response: Response):
    auth.end_session(request.cookies.get(auth.COOKIE))
    response.delete_cookie(auth.COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(op: dict = Operator):
    return {k: op[k] for k in ("username", "display_name", "is_admin")}
```

- [ ] **Step 9: Wire into `server/app/main.py`**
  - Change the import line to `from . import db, interpret, office_db, operator_api, photo, update, voice`.
  - In `lifespan`, after `db.init()`: `office_db.connect().close()  # create office tables`.
  - After `app = FastAPI(...)` and the exception handler: `app.include_router(operator_api.router)`.

- [ ] **Step 10: Run** `cd server && .venv/Scripts/python.exe -m pytest -q` — expected: all new tests pass, total 41 passed, 1 skipped.

- [ ] **Step 11: Commit**

```bash
git add server/requirements.txt server/app/office_db.py server/app/ratelimit.py server/app/auth.py server/app/operator_api.py server/app/photos.py server/app/main.py server/tests/conftest.py server/tests/test_auth.py
git commit -m "feat(server): office DB, operator accounts and session login"
```

---

### Task 3: Photos, office items, AI draft, operator item routes, CLI

**Files:**
- Modify: `server/app/photos.py`, `server/app/operator_api.py`, `server/app/main.py`
- Create: `server/app/office.py`, `server/app/office_api.py`, `server/app/operators.py`, `server/tests/test_office_items.py`

**Interfaces:**
- Consumes: Task 2 (`office_db`, `auth.current_operator`, `auth.create_operator`, `auth.set_password`, `operator_api.router`).
- Produces:
  - `photos.DIR: Path`; `photos.save_draft(data: bytes, content_type: str | None) -> str` (32-hex draft id; raises 400/413); `photos.promote(draft_id: str) -> str` (file name `<hex>.webp`; raises 400 if unknown); `photos.purge_drafts(max_age: float = 86400) -> int`; `photos.url(name: str | None) -> str | None` (`/api/photos/<name>`); `photos.NAME_RE`
  - `office.CATEGORIES: tuple[str, ...]`, `office.COLOURS: tuple[str, ...]`
  - `office.to_item(row) -> dict` (public Item JSON)
  - `office.public_id(n: int) -> str` (`office-<n>`); `office.parse_id(s: str) -> int | None`
  - `office.public_item(public_id: str) -> dict | None` (only available/reserved)
  - `office.create(fields: dict, operator_id: int) -> dict` (operator item JSON)
  - `office.update(item_id: int, fields: dict) -> dict`
  - `office.operator_item(row) -> dict` = `to_item(row)` + `{"status": row status (all 4 values), "created_at", "updated_at"}`
  - `office.list_items(status=None, category=None, q="", limit=50, offset=0) -> {"items": [...], "total": int}`
  - `office_api.router: APIRouter` with `GET /api/photos/{name}`

- [ ] **Step 1: Write failing tests** `server/tests/test_office_items.py`:

```python
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
```

- [ ] **Step 2: Run** `cd server && .venv/Scripts/python.exe -m pytest tests/test_office_items.py -q` — expected FAIL (missing endpoints / attributes).

- [ ] **Step 3: Implement `server/app/photos.py`** (replace the Task 2 stub)

```python
"""Office photo uploads (spec §1 "Photos"): re-encoded WebP, EXIF stripped, drafts expire."""
import io
import os
import re
import time
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from . import office_db

DIR = Path(os.environ.get("PHOTOS_DIR", office_db.PATH.parent / "photos"))
MAX_BYTES = 8 * 1024 * 1024
TYPES = {"image/jpeg", "image/png", "image/webp"}
LONGEST = 1200
NAME_RE = re.compile(r"^[0-9a-f]{32}\.webp$")
_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _drafts() -> Path:
    d = Path(DIR) / "drafts"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_draft(data: bytes, content_type: str | None) -> str:
    if content_type not in TYPES:
        raise HTTPException(400, "bad_request: image must be jpeg, png or webp")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "too_large: image exceeds 8 MB")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(400, "bad_request: not a readable image") from None
    img.thumbnail((LONGEST, LONGEST))
    draft_id = uuid.uuid4().hex
    img.save(_drafts() / f"{draft_id}.webp", "WEBP", quality=82)  # no exif= → metadata dropped
    return draft_id


def draft_path(draft_id: str) -> Path | None:
    if not _ID_RE.match(draft_id or ""):
        return None
    p = _drafts() / f"{draft_id}.webp"
    return p if p.exists() else None


def promote(draft_id: str) -> str:
    src = draft_path(draft_id)
    if src is None:
        raise HTTPException(400, "bad_request: unknown or expired photo, upload it again")
    name = f"{draft_id}.webp"
    src.replace(Path(DIR) / name)
    return name


def purge_drafts(max_age: float = 86400) -> int:
    cutoff, n = time.time() - max_age, 0
    for p in _drafts().glob("*.webp"):
        if p.stat().st_mtime < cutoff:
            p.unlink(missing_ok=True)
            n += 1
    return n


def url(name: str | None) -> str | None:
    return f"/api/photos/{name}" if name else None


def file(name: str) -> Path | None:
    if not NAME_RE.match(name):
        return None
    p = Path(DIR) / name
    return p if p.is_file() else None
```

Note on draft preview: `POST /draft` returns `photo_url` = `/api/operator/drafts/<id>.webp` served by an authenticated route (drafts are not public). Add that route in Step 6.

- [ ] **Step 4: Implement `server/app/office.py`**

```python
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
```

- [ ] **Step 5: Implement `server/app/office_api.py`**

```python
"""Public office endpoints: photos, slots, booking, manage link (spec §2 "Public endpoints")."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from . import photos

router = APIRouter()


@router.get("/api/photos/{name}")
def photo_file(name: str):
    p = photos.file(name)
    if p is None:
        raise HTTPException(404, "not_found: no such photo")
    return FileResponse(p, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})
```

- [ ] **Step 6: Append to `server/app/operator_api.py`**

```python
import asyncio
from datetime import date
from typing import Literal

from fastapi import File, Query, UploadFile
from fastapi.responses import FileResponse

from . import interpret, office, photo, photos

AI_TIMEOUT = 14.0


@router.post("/items/draft")
async def draft(image: UploadFile = File(...), op: dict = Operator):
    data = await image.read(photos.MAX_BYTES + 1)
    draft_id = photos.save_draft(data, image.content_type)
    suggested = None
    try:
        text = await asyncio.wait_for(photo.describe(data, image.content_type), timeout=AI_TIMEOUT)
        if text and text.strip():
            f = await asyncio.to_thread(interpret.interpret, text, "it") or {}
            suggested = {"category": f.get("category"), "brand": f.get("brand"),
                         "colour": f.get("colour"), "descr": text.strip()}
    except Exception:  # AI pre-fill is optional; the operator fills the form by hand
        suggested = None
    return {"draft_id": draft_id, "photo_url": f"/api/operator/drafts/{draft_id}.webp", "suggested": suggested}


@router.get("/drafts/{name}")
def draft_file(name: str, op: dict = Operator):
    p = photos.draft_path(name.removesuffix(".webp"))
    if p is None:
        raise HTTPException(404, "not_found: no such draft")
    return FileResponse(p, media_type="image/webp")


class ItemIn(BaseModel):
    draft_id: str | None = None
    category: str
    brand: str | None = Field(None, max_length=40)
    colour: str | None = None
    descr: str = Field(min_length=3, max_length=500)
    found_place: str = Field(min_length=2, max_length=120)
    found_at: str


class ItemPatch(BaseModel):
    draft_id: str | None = None
    category: str | None = None
    brand: str | None = Field(None, max_length=40)
    colour: str | None = None
    descr: str | None = Field(None, min_length=3, max_length=500)
    found_place: str | None = Field(None, min_length=2, max_length=120)
    found_at: str | None = None
    status: Literal["returned", "discarded"] | None = None


@router.post("/items")
def create_item(req: ItemIn, op: dict = Operator):
    return office.create(req.model_dump(), op["id"])


@router.patch("/items/{item_id}")
def patch_item(item_id: int, req: ItemPatch, op: dict = Operator):
    return office.update(item_id, req.model_dump(exclude_unset=True))


@router.get("/items")
def list_items(
    status: Literal["available", "reserved", "returned", "discarded"] | None = None,
    category: str | None = None,
    q: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    op: dict = Operator,
):
    return office.list_items(status, category, q, limit, offset)
```
Move the new imports to the top of the file with the existing ones. (The `ItemPatch` `brand`/`colour` fields: sending `null` clears them because `exclude_unset` keeps explicit nulls.)

- [ ] **Step 7: Wire in `main.py`**
  - Import `office, office_api, photos` alongside the others.
  - `app.include_router(office_api.router)` next to the operator router.
  - In `one_item`: before `db.item`, add
    ```python
    if item_id.startswith("office-"):
        found = office.public_item(item_id)
    else:
        found = db.item(item_id)
    ```
    (replace the existing `found = db.item(item_id)` line).
  - In `lifespan`, after the office DB line, start a purge thread that runs regardless of `UPDATE_DISABLED`:
    ```python
    def purger():
        while True:
            try:
                photos.purge_drafts()
            except Exception:
                logging.exception("draft purge failed")
            time.sleep(3600)
    threading.Thread(target=purger, daemon=True, name="draft-purge").start()
    ```

- [ ] **Step 8: Create CLI `server/app/operators.py`**

```python
"""Operator admin CLI.

    python -m app.operators create-admin <username>      # prompts for the password
    python -m app.operators seed-demo --password <pw>    # operator "demo" + sample office items
"""
import argparse
import getpass
import io
import sys
from datetime import date, timedelta

from PIL import Image, ImageDraw

from . import auth, office, office_db, photos

SWATCH = {"black": (34, 34, 34), "brown": (120, 72, 40), "blue": (40, 80, 160), "red": (180, 40, 40),
          "silver": (190, 190, 195), "pink": (230, 140, 170), "green": (50, 120, 70), "beige": (215, 195, 160)}

DEMO_ITEMS = [
    ("wallet", None, "black", "Portafoglio in pelle nero con tessera ATAC", "Termini, binario 4", 1),
    ("phone", "SAMSUNG", "blue", "Smartphone Samsung con cover blu", "Metro A, Spagna", 2),
    ("keys", None, "silver", "Mazzo di tre chiavi con portachiavi Colosseo", "Bus 64, Largo Argentina", 2),
    ("bag", None, "brown", "Zaino marrone con libri universitari", "Piazza Navona", 3),
    ("glasses", "RAY-BAN", "black", "Occhiali da sole Ray-Ban in custodia", "Fontana di Trevi", 4),
    ("clothing", None, "red", "Sciarpa di lana rossa", "Musei Vaticani, ingresso", 5),
    ("electronics", "APPLE", "silver", "Auricolari AirPods con custodia", "Tram 8, Trastevere", 6),
    ("watch_jewelry", None, "pink", "Braccialetto rosa con ciondolo a cuore", "Villa Borghese", 7),
]


def _placeholder(colour: str, label: str) -> bytes:
    img = Image.new("RGB", (900, 900), SWATCH.get(colour, (120, 120, 120)))
    d = ImageDraw.Draw(img)
    d.rectangle((60, 60, 840, 840), outline=(255, 255, 255), width=12)
    d.text((100, 420), label.upper(), fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def seed_demo(password: str) -> int:
    try:
        auth.create_operator("demo", password, "Demo operator")
    except ValueError:
        auth.set_password("demo", password)
    with office_db.connect() as con:
        if con.execute("SELECT count(*) FROM office_items").fetchone()[0]:
            return 0
        op_id = con.execute("SELECT id FROM operators WHERE username = 'demo'").fetchone()[0]
    for category, brand, colour, descr, place, days_ago in DEMO_ITEMS:
        draft_id = photos.save_draft(_placeholder(colour, category), "image/jpeg")
        office.create({"draft_id": draft_id, "category": category, "brand": brand, "colour": colour,
                       "descr": descr, "found_place": place,
                       "found_at": (date.today() - timedelta(days=days_ago)).isoformat()}, op_id)
    return len(DEMO_ITEMS)


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m app.operators")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("create-admin")
    a.add_argument("username")
    a.add_argument("--display-name")
    s = sub.add_parser("seed-demo")
    s.add_argument("--password", required=True)
    args = p.parse_args(argv)
    if args.cmd == "create-admin":
        pw = getpass.getpass("Password: ")
        if pw != getpass.getpass("Repeat: "):
            sys.exit("passwords differ")
        try:
            auth.create_operator(args.username, pw, args.display_name, is_admin=True)
        except ValueError as e:
            sys.exit(str(e))
        print(f"created admin {args.username}")
    else:
        print(f"seeded {seed_demo(args.password)} office items; operator 'demo' ready")


if __name__ == "__main__":
    main()
```

Add test at the end of `server/tests/test_office_items.py`:

```python
def test_seed_demo_is_idempotent():
    from app import operators
    assert operators.seed_demo("demo-pass-123") == 8
    assert operators.seed_demo("demo-pass-123") == 0
    c = TestClient(app)
    assert c.post("/api/operator/login", json={"username": "demo", "password": "demo-pass-123"}).status_code == 200
```

- [ ] **Step 9: Run** `cd server && .venv/Scripts/python.exe -m pytest -q` — expected: all pass (existing 34 + Task 2 + Task 3).

- [ ] **Step 10: Commit**

```bash
git add server/app/photos.py server/app/office.py server/app/office_api.py server/app/operator_api.py server/app/operators.py server/app/main.py server/tests/test_office_items.py
git commit -m "feat(server): office items with photo intake, AI pre-fill and admin CLI"
```

---

### Task 4: Office hours, slots, booking, manage link, operator booking routes

**Files:**
- Create: `server/app/office_hours.py`, `server/app/booking.py`, `server/tests/test_booking.py`
- Modify: `server/app/office_api.py`, `server/app/operator_api.py`

**Interfaces:**
- Consumes: Task 2 `office_db`, `ratelimit.BOOKING`, `ratelimit.client_ip`, `auth.current_operator`; Task 3 `office.parse_id`, `office.get`, `office.to_item`, `office.public_id`.
- Produces:
  - `office_hours.ROME`, `office_hours.today() -> date`, `office_hours.window() -> tuple[date, date]`, `office_hours.slots_for(d: date) -> list[str]`, `office_hours.is_bookable(slot: str) -> bool`
  - `booking.slots(d: date) -> list[{"start": str, "free": bool}]`
  - `booking.book(public_item_id: str, name: str, contact: str, slot_start: str) -> {"code", "manage_token", "slot_start", "item_id"}`
  - `booking.by_token(token) -> dict | None` — `{"code","status","slot_start","name","contact","item": Item}`
  - `booking.cancel_by_token(token) -> dict`
  - `booking.day(d: date) -> list[dict]` — `{"id","code","status","slot_start","name","contact","item": operator item}`
  - `booking.set_status(booking_id: int, status: str) -> dict`

- [ ] **Step 1: Write failing tests** `server/tests/test_booking.py`:

```python
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
```

Note on `test_contact_limit_and_ip_limit`: count carefully when implementing — `BOOKING` counts every booking attempt per IP that passes validation of body shape (hit the limiter first, before other checks). Attempts: 1 (ok) + 2 (ok) + 3 (contact 429) + loop 4, 5, 6 → the 6th attempt must be 429. If you change the limiter position, fix the test arithmetic, not the limit.

- [ ] **Step 2: Run** `cd server && .venv/Scripts/python.exe -m pytest tests/test_booking.py -q` — expected FAIL.

- [ ] **Step 3: Implement `server/app/office_hours.py`**

```python
"""Pickup slots (spec §1 "Slots"): 15 minutes, Europe/Rome, tomorrow .. today+14."""
import json
import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ROME = ZoneInfo("Europe/Rome")
SLOT = timedelta(minutes=15)
WINDOW_DAYS = 14
# weekday (0 = Monday) -> list of [open, close]
DEFAULT_HOURS = {
    "0": [["08:30", "13:00"]],
    "1": [["08:30", "13:00"], ["14:30", "16:30"]],
    "2": [["08:30", "13:00"]],
    "3": [["08:30", "13:00"], ["14:30", "16:30"]],
    "4": [["08:30", "13:00"]],
}
FMT = "%Y-%m-%dT%H:%M"


def hours() -> dict[int, list[tuple[time, time]]]:
    raw = json.loads(os.environ.get("OFFICE_HOURS_JSON") or "null") or DEFAULT_HOURS
    return {int(k): [(time.fromisoformat(a), time.fromisoformat(b)) for a, b in v] for k, v in raw.items()}


def today() -> date:
    return datetime.now(ROME).date()


def window() -> tuple[date, date]:
    t = today()
    return t + timedelta(days=1), t + timedelta(days=WINDOW_DAYS)


def slots_for(d: date) -> list[str]:
    out = []
    for start, end in hours().get(d.weekday(), []):
        t = datetime.combine(d, start)
        while t + SLOT <= datetime.combine(d, end):
            out.append(t.strftime(FMT))
            t += SLOT
    return out


def is_bookable(slot: str) -> bool:
    try:
        d = datetime.strptime(slot, FMT).date()
    except (TypeError, ValueError):
        return False
    first, last = window()
    return first <= d <= last and slot in slots_for(d)
```

- [ ] **Step 4: Implement `server/app/booking.py`**

```python
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
```

Implementation note: SQLite reports a partial-unique-index violation as `UNIQUE constraint failed: bookings.slot_start` or `bookings.item_id`; the code above branches on that text. Keep the `with office_db.connect()` block as the single transaction (the `with` commits at the end and rolls back on any exception).

Continue in the same file:

```python
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


def day(d: date) -> list[dict]:
    with office_db.connect() as con:
        rows = con.execute("SELECT * FROM bookings WHERE slot_start LIKE ? ORDER BY slot_start, id",
                           (f"{d.isoformat()}T%",)).fetchall()
        out = []
        for b in rows:
            item = con.execute("SELECT * FROM office_items WHERE id = ?", (b["item_id"],)).fetchone()
            out.append({"id": b["id"], "code": b["code"], "status": b["status"], "slot_start": b["slot_start"],
                        "name": b["name"], "contact": b["contact"], "item": office.operator_item(item)})
    return out


def set_status(booking_id: int, status: str) -> dict:
    with office_db.connect() as con:
        b = con.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if b is None:
            raise HTTPException(404, "not_found: booking not found")
        if b["status"] != "booked":
            raise HTTPException(409, "conflict: booking is no longer active")
        _close(con, b, status)
        b = con.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        item = con.execute("SELECT * FROM office_items WHERE id = ?", (b["item_id"],)).fetchone()
        return {"id": b["id"], "code": b["code"], "status": b["status"], "slot_start": b["slot_start"],
                "name": b["name"], "contact": b["contact"], "item": office.operator_item(item)}
```

- [ ] **Step 5: Append public routes to `server/app/office_api.py`**

```python
from datetime import date
from typing import Literal

from fastapi import Request
from pydantic import BaseModel, Field

from . import booking, ratelimit


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, "bad_request: date must be yyyy-mm-dd") from None


@router.get("/api/office/slots")
def office_slots(date: str):  # noqa: A002 — query name is part of the contract
    d = _date(date)
    return {"date": d.isoformat(), "slots": booking.slots(d)}


class BookRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    contact: str = Field(min_length=3, max_length=120)
    slot_start: str = Field(max_length=16)
    ack: Literal[True]


@router.post("/api/office/items/{item_id}/book")
def book_item(item_id: str, req: BookRequest, request: Request):
    if not ratelimit.BOOKING.hit(ratelimit.client_ip(request)):
        raise HTTPException(429, "rate_limited: too many bookings, try again later")
    return booking.book(item_id, req.name, req.contact, req.slot_start)


@router.get("/api/bookings/{token}")
def get_booking(token: str):
    found = booking.by_token(token)
    if found is None:
        raise HTTPException(404, "not_found: booking not found")
    return found


@router.delete("/api/bookings/{token}")
def cancel_booking(token: str):
    return booking.cancel_by_token(token)
```
Move imports to the top. Because the function parameter `date` shadows `datetime.date`, `_date` must be defined above using the module-level `date` (it is).

- [ ] **Step 6: Append operator booking routes to `server/app/operator_api.py`**

Add to the top imports: `from datetime import date as Date` and `booking` to the `from . import …` line.

```python
@router.get("/bookings")
def day_bookings(date: str, op: dict = Operator):  # query name is part of the contract
    try:
        d = Date.fromisoformat(date)
    except ValueError:
        raise HTTPException(400, "bad_request: date must be yyyy-mm-dd") from None
    return booking.day(d)


class BookingPatch(BaseModel):
    status: Literal["collected", "no_show", "cancelled"]


@router.patch("/bookings/{booking_id}")
def patch_booking(booking_id: int, req: BookingPatch, op: dict = Operator):
    return booking.set_status(booking_id, req.status)
```
- [ ] **Step 7: Run** `cd server && .venv/Scripts/python.exe -m pytest -q` — expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/app/office_hours.py server/app/booking.py server/app/office_api.py server/app/operator_api.py server/tests/test_booking.py
git commit -m "feat(server): pickup slots, bookings, manage link and desk status changes"
```

---

### Task 5: Search merge (colour/place in Interpreted, `office` field everywhere)

**Files:**
- Modify: `server/app/office.py`, `server/app/interpret.py`, `server/app/db.py`, `server/app/main.py`
- Create: `server/tests/test_office_search.py`

**Interfaces:**
- Consumes: Task 3 `office.to_item`, `office.COLOURS`.
- Produces:
  - `office.search(filters: dict, limit: int = 6) -> list[dict]` — filters keys as Interpreted (`category, brand, keywords, date_from, date_to, colour, place`)
  - `office.browse(q="", category=None, brand=None, date_from=None, date_to=None, limit=20, offset=0) -> {"items", "total"}`
  - `interpret.interpret()` and `fallback_interpret()` return dicts with `colour` and `place` keys (possibly None)
  - `interpret.search(text, lang)` returns `{"items","total","interpreted","office"}`
  - registry `Item` gets `origin: "registry"`, `colour/found_place/photo_url/status: None`

- [ ] **Step 1: Write failing tests** `server/tests/test_office_search.py`:

```python
from fastapi.testclient import TestClient

from app import interpret, office
from app.main import app


def add(category="wallet", colour="black", descr="Portafoglio in pelle", place="Termini", found_at="2026-11-10",
        brand=None):
    return office.create({"category": category, "colour": colour, "descr": descr, "found_place": place,
                          "found_at": found_at, "brand": brand}, 1)["id"]


def fake(monkeypatch, **f):
    base = {"category": None, "brand": None, "keywords": [], "date_from": None, "date_to": None,
            "ignored": [], "colour": None, "place": None}
    monkeypatch.setattr(interpret, "interpret", lambda text, lang: {**base, **f})


def search(q="x"):
    return TestClient(app).post("/api/search", json={"query": q, "lang": "en"}).json()


def test_registry_items_have_origin():
    it = TestClient(app).get("/api/items", params={"limit": 1}).json()["items"][0]
    assert it["origin"] == "registry" and it["photo_url"] is None and it["colour"] is None


def test_office_list_and_registry_unchanged(monkeypatch):
    fake(monkeypatch, category="wallet")
    before = search("wallet a")
    add()
    after = search("wallet b")
    assert before["office"] == [] and len(after["office"]) == 1
    assert after["total"] == before["total"]
    assert [i["id"] for i in after["items"]] == [i["id"] for i in before["items"]]


def test_colour_and_place_rank(monkeypatch):
    red = add(colour="red", place="Colosseo")
    black = add(colour="black", place="Colosseo")
    black_termini = add(colour="black", place="Stazione Termini")
    fake(monkeypatch, category="wallet", colour="black", place="Termini")
    ids = [i["id"] for i in search()["office"]]
    assert ids == [black_termini, black, red]


def test_hard_filters_and_relaxation(monkeypatch):
    add(category="keys", descr="Mazzo di chiavi")
    fake(monkeypatch, category="wallet")
    assert search()["office"] == []  # category is never relaxed
    w = add(found_at="2026-01-05")
    fake(monkeypatch, category="wallet", keywords=["GUCCI"], date_from="2026-10-01", date_to="2026-10-31")
    assert [i["id"] for i in search()["office"]] == [w]  # keywords then dates dropped


def test_reserved_last_and_hidden_statuses(monkeypatch):
    a, b = add(descr="Portafoglio A"), add(descr="Portafoglio B")
    from app import office_db
    with office_db.connect() as con:
        con.execute("UPDATE office_items SET status='reserved' WHERE id=?", (office.parse_id(b),))
    c = add(descr="Portafoglio C")
    with office_db.connect() as con:
        con.execute("UPDATE office_items SET status='discarded' WHERE id=?", (office.parse_id(c),))
    fake(monkeypatch, category="wallet")
    ids = [i["id"] for i in search()["office"]]
    assert ids == [a, b]


def test_limit_six(monkeypatch):
    for i in range(8):
        add(descr=f"Portafoglio {i}")
    fake(monkeypatch, category="wallet")
    assert len(search()["office"]) == 6


def test_catalogue_browse(monkeypatch):
    w = add()
    add(category="keys", descr="Chiavi")
    c = TestClient(app)
    r = c.get("/api/items", params={"source": "office", "category": "wallet"}).json()
    assert r["total"] == 1 and r["items"][0]["id"] == w and r["office"] == []
    r = c.get("/api/items", params={"category": "wallet"}).json()
    assert [i["id"] for i in r["office"]] == [w] and r["items"][0]["origin"] == "registry"
    assert c.get("/api/items", params={"category": "wallet", "offset": 20}).json()["office"] == []


def test_interpret_normalises_colour_and_place(monkeypatch):
    monkeypatch.setattr(interpret, "_request_filter_agent", lambda t, l: None)
    monkeypatch.setattr(interpret, "_request_filter", lambda t, l: {
        "category": "wallet", "colour": "Black", "place": "  Termini  ", "keywords": [], "ignored": []})
    f = interpret.interpret("black wallet at Termini", "en")
    assert f["colour"] == "black" and f["place"] == "Termini"
    monkeypatch.setattr(interpret, "_request_filter", lambda t, l: {"category": "wallet", "colour": "teal"})
    f = interpret.interpret("teal wallet", "en")
    assert f["colour"] is None and f["place"] is None


def test_fallback_has_new_keys():
    f = interpret.fallback_interpret("portafoglio")
    assert f["colour"] is None and f["place"] is None
```

- [ ] **Step 2: Run** `cd server && .venv/Scripts/python.exe -m pytest tests/test_office_search.py -q` — expected FAIL.

- [ ] **Step 3: `db.py` `_item`** — add to the returned dict:

```python
        "origin": "registry",
        "colour": None,
        "found_place": None,
        "photo_url": None,
        "status": None,
```

- [ ] **Step 4: Append to `server/app/office.py`**

```python
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
```

- [ ] **Step 5: `interpret.py` changes**
  - Add `from . import office` to the imports (next to `db`).
  - In `_prompt`, replace the final line `'"Samsung phone" -> []). Never include user words.'` with these four lines (still inside the parenthesised string concatenation):
    ```python
        '"Samsung phone" -> []). Never include user words in "ignored". '
        f'Also "colour": the item colour as one of {", ".join(office.COLOURS)}, or null; and '
        '"place": where it was lost, as the user wrote it (e.g. "Termini", "bus 64"), or null. '
        "Colour and place stay listed in ignored as well."
    ```
  - In `interpret()`, before `return`, compute:
    ```python
    colour = parsed.get("colour")
    colour = colour.strip().lower() if isinstance(colour, str) else None
    if colour not in office.COLOURS:
        colour = None
    place = parsed.get("place")
    place = " ".join(place.split())[:80] or None if isinstance(place, str) else None
    ```
    and add `"colour": colour, "place": place,` to the returned dict.
  - In both returns of `fallback_interpret`, add `"colour": None, "place": None,`.
  - In `search()`: right after `if filters is None: filters = fallback_interpret(text, lang)`, add `office_items = office.search(filters)`; change the final return to
    `return {**result, "interpreted": shown and {**shown, "relaxed": relaxed}, "office": office_items}`.
  - If `office.py` importing nothing from `interpret` is kept, there is no cycle (office imports `office_db`, `photos` only). Verify with `python -c "import app.main"`.

- [ ] **Step 6: `main.py` changes**
  - `items()`: add parameter `source: Literal["office"] | None = None`; body:
    ```python
    if source == "office":
        return {**office.browse(q, category, brand, date_from, date_to, limit, offset), "interpreted": None, "office": []}
    reg = db.search(q.split(), category, brand, date_from, date_to, limit, offset)
    near = office.browse(q, category, brand, date_from, date_to, 6, 0)["items"] if offset == 0 else []
    return {**reg, "interpreted": None, "office": near}
    ```
  - `search_voice`: the empty-transcript return gains `"office": []`.
  - `search_photo`: the no-description return gains `"office": []`.

- [ ] **Step 7: Run** `cd server && .venv/Scripts/python.exe -m pytest -q` — expected: everything passes, including all pre-existing tests (registry results unchanged).

- [ ] **Step 8: Commit**

```bash
git add server/app/office.py server/app/interpret.py server/app/db.py server/app/main.py server/tests/test_office_search.py
git commit -m "feat(server): office matches in every search, colour and place understood"
```

---

### Task 6: Web contract, router and public office UI (strip, item page, booking, manage page, i18n)

**Files:**
- Modify: `web/src/api.ts`, `web/src/lib/router.ts`, `web/src/App.tsx`, `web/src/components/ItemTag.tsx`, `web/src/components/Understood.tsx`, `web/src/pages/ItemPage.tsx`, `web/src/pages/Search.tsx`, `web/src/pages/Catalogue.tsx`, `web/src/pages/Home.tsx`, `web/src/i18n/{en,it,es,fr,de}.ts`
- Create: `web/src/lib/colours.ts`, `web/src/lib/ics.ts`, `web/src/components/OfficeCard.tsx`, `web/src/components/OfficeStrip.tsx`, `web/src/components/BookingPanel.tsx`, `web/src/pages/OfficeItemPage.tsx`, `web/src/pages/ManageBooking.tsx`

**Interfaces:**
- Consumes: server contract from Tasks 3–5.
- Produces (used by Task 7):
  - `api.ts`: types `Item` (with `origin`, `source: {page,url} | null`, `colour`, `found_place`, `photo_url`, `status`), `OperatorItem = Item & { status: 'available'|'reserved'|'returned'|'discarded'; created_at: string; updated_at: string }`, `DayBooking`, `Operator`, `Draft`, `ItemFields`; helpers `opLogin, opLogout, opMe, opDraft, opCreateItem, opPatchItem, opListItems, opDayBookings, opPatchBooking`
  - `lib/router.ts`: `Route` variants `{ name: 'booking'; token: string }` and `{ name: 'operator'; page: 'today' | 'login' | 'new' | 'items' | 'bookings'; params: URLSearchParams }`
  - `lib/colours.ts`: `COLOURS` (ordered ids), `SWATCH: Record<Colour, string>`, `type Colour`
  - `CATEGORIES` constant exported from `lib/colours.ts` too (15 ids, Global Constraints order)

- [ ] **Step 1: `web/src/api.ts`** — update types and add helpers:

```ts
export type Origin = 'registry' | 'office'

export type Item = {
  id: string // registry "<year>-<reperto>-<page>" or "office-<n>"
  origin: Origin
  year: number
  reperto: number | null
  date: string // ISO yyyy-mm-dd; office: date found
  descr: string
  category: string
  tags: string[]
  brand: string | null
  number_guessed?: boolean
  source: { page: number; url: string } | null // null for office items
  colour: string | null // office only
  found_place: string | null // office only
  photo_url: string | null // office only
  status: 'available' | 'reserved' | null // office only
}
```
`Interpreted` gains `colour?: string | null` and `place?: string | null`. `SearchResponse` gains `office?: Item[]`. `ItemsParams` gains `source?: 'office'`.

Append:

```ts
export const getItem = (id: string) => fetch(`/api/items/${encodeURIComponent(id)}`).then(json<Item>)

export type Slot = { start: string; free: boolean } // "YYYY-MM-DDTHH:MM", Europe/Rome
export const getSlots = (date: string) =>
  fetch(`/api/office/slots?date=${date}`).then(json<{ date: string; slots: Slot[] }>)

export type BookingResult = { code: string; manage_token: string; slot_start: string; item_id: string }
export const bookItem = (id: string, body: { name: string; contact: string; slot_start: string }) =>
  fetch(`/api/office/items/${encodeURIComponent(id)}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, ack: true }),
  }).then(json<BookingResult>)

export type BookingStatus = 'booked' | 'collected' | 'no_show' | 'cancelled'
export type Booking = { code: string; status: BookingStatus; slot_start: string; name: string; contact: string; item: Item }
export const getBooking = (token: string) => fetch(`/api/bookings/${encodeURIComponent(token)}`).then(json<Booking>)
export const cancelBooking = (token: string) =>
  fetch(`/api/bookings/${encodeURIComponent(token)}`, { method: 'DELETE' }).then(json<Booking>)

// --- operator back-office (cookie session) ---
export type Operator = { username: string; display_name: string; is_admin: boolean }
export type OperatorItem = Omit<Item, 'status'> & {
  status: 'available' | 'reserved' | 'returned' | 'discarded'
  created_at: string
  updated_at: string
}
export type ItemFields = {
  category: string
  brand: string | null
  colour: string | null
  descr: string
  found_place: string
  found_at: string
}
export type Draft = {
  draft_id: string
  photo_url: string
  suggested: { category: string | null; brand: string | null; colour: string | null; descr: string } | null
}
export type DayBooking = { id: number; code: string; status: BookingStatus; slot_start: string; name: string; contact: string; item: OperatorItem }

const send = (method: string, path: string, body?: unknown) =>
  fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const opLogin = (username: string, password: string) => send('POST', '/api/operator/login', { username, password }).then(json<Operator>)
export const opLogout = () => send('POST', '/api/operator/logout').then(json<{ ok: boolean }>)
export const opMe = () => fetch('/api/operator/me').then(json<Operator>)
export const opDraft = (image: Blob) => {
  const form = new FormData()
  form.append('image', image)
  return fetch('/api/operator/items/draft', { method: 'POST', body: form }).then(json<Draft>)
}
export const opCreateItem = (fields: ItemFields & { draft_id?: string }) => send('POST', '/api/operator/items', fields).then(json<OperatorItem>)
export const opPatchItem = (n: number, fields: Partial<ItemFields> & { draft_id?: string; status?: 'returned' | 'discarded' }) =>
  send('PATCH', `/api/operator/items/${n}`, fields).then(json<OperatorItem>)
export const opListItems = (p: { status?: string; category?: string; q?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
  return fetch(`/api/operator/items?${qs}`).then(json<{ items: OperatorItem[]; total: number }>)
}
export const opDayBookings = (date: string) => fetch(`/api/operator/bookings?date=${date}`).then(json<DayBooking[]>)
export const opPatchBooking = (id: number, status: 'collected' | 'no_show' | 'cancelled') =>
  send('PATCH', `/api/operator/bookings/${id}`, { status }).then(json<DayBooking>)

/** "office-42" → 42 */
export const officeNumber = (id: string) => Number(id.replace(/^office-/, ''))
```

- [ ] **Step 2: Fix nullable `source` usages** — `ItemTag.tsx:32`, `Home.tsx:58`, `ItemPage.tsx:58-61`: guard with `item.source && …` (render nothing when null). Run `cd web && npx tsc -b` — expected: no errors.

- [ ] **Step 3: `web/src/lib/colours.ts`**

```ts
export const CATEGORIES = [
  'wallet', 'id_document', 'payment_card', 'bag', 'phone', 'other', 'keys', 'document_other',
  'electronics', 'clothing', 'glasses', 'sim', 'watch_jewelry', 'money', 'vehicle',
] as const

export const COLOURS = [
  'black', 'white', 'grey', 'silver', 'gold', 'red', 'orange', 'yellow', 'green', 'blue',
  'purple', 'pink', 'brown', 'beige', 'multicolour',
] as const
export type Colour = (typeof COLOURS)[number]

export const SWATCH: Record<Colour, string> = {
  black: '#111111', white: '#ffffff', grey: '#8a8a8a', silver: '#c8c8cc', gold: '#d4a017', red: '#c62828',
  orange: '#ef6c00', yellow: '#f9d71c', green: '#2e7d32', blue: '#1e5bb8', purple: '#6a1b9a', pink: '#e88aa8',
  brown: '#6d4c41', beige: '#d8c3a5',
  multicolour: 'conic-gradient(#c62828, #f9d71c, #2e7d32, #1e5bb8, #6a1b9a, #c62828)',
}
```

- [ ] **Step 4: `web/src/lib/ics.ts`**

```ts
/** Calendar file for a pickup slot; built in the browser, nothing leaves the device. */
export function pickupIcs(opts: { code: string; slotStart: string; title: string; location: string; url: string }) {
  const stamp = (s: string) => s.replace(/[-:]/g, '') + '00' // "2026-11-16T09:00" → "20261116T090000"
  const [d, t] = opts.slotStart.split('T')
  const [h, m] = t.split(':').map(Number)
  const endMin = h * 60 + m + 15
  const end = `${d}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritrovato//Pickup//EN', 'BEGIN:VEVENT',
    `UID:${opts.code}@ritrovato`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Europe/Rome:${stamp(opts.slotStart)}`,
    `DTEND;TZID=Europe/Rome:${stamp(end)}`,
    `SUMMARY:${esc(opts.title)}`, `LOCATION:${esc(opts.location)}`, `DESCRIPTION:${esc(opts.code + '\n' + opts.url)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' })
}
```

- [ ] **Step 5: Router** — in `web/src/lib/router.ts` extend `Route` and `parse`:

```ts
  | { name: 'booking'; token: string }
  | { name: 'operator'; page: 'today' | 'login' | 'new' | 'items' | 'bookings'; params: URLSearchParams }
```
```ts
  if (path.startsWith('booking/')) return { name: 'booking', token: decodeURIComponent(path.slice(8)) }
  if (path === 'operator' || path.startsWith('operator/')) {
    const sub = path.slice(9) || 'today'
    const page = (['login', 'new', 'items', 'bookings'] as const).find((p) => p === sub) ?? 'today'
    return { name: 'operator', page, params }
  }
```
Update the comment block at the top of the file with the new routes.

- [ ] **Step 6: Public strings** — add to `web/src/i18n/en.ts` (the `Strings` type is derived from it, so every language must get the same keys):

```ts
  office: {
    stripTitle: 'Found at the office',
    stripLead: 'Logged by staff with a photo. You can book a pickup.',
    badge: 'Logged at the office',
    registryBadge: 'From the city PDF',
    reserved: 'Pickup booked',
    foundPlace: 'Found at',
    colour: 'Colour',
    date: 'Found on',
    recent: 'Recently logged at the office',
    notRecordedOffice: 'not recorded in the city PDF — used for office items',
    notFound: 'This item is no longer available.',
  },
  colours: {
    black: 'Black', white: 'White', grey: 'Grey', silver: 'Silver', gold: 'Gold', red: 'Red', orange: 'Orange',
    yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple', pink: 'Pink', brown: 'Brown', beige: 'Beige',
    multicolour: 'Multicolour',
  } as Record<string, string>,
  booking: {
    cta: 'Book a pickup',
    day: 'Day',
    time: 'Time',
    noSlots: 'No free times on this day.',
    name: 'Your name',
    contact: 'Email or phone',
    ack: 'I understand I must describe the item and show ID at the desk.',
    confirm: 'Confirm booking',
    sending: 'Booking…',
    slotTaken: 'That time was just taken — pick another.',
    itemTaken: 'Someone booked this item a moment ago.',
    tooMany: 'Too many bookings. Try again later.',
    error: 'Booking failed. Try again.',
    done: 'Pickup booked',
    code: 'Booking code',
    when: 'When',
    bring: 'Bring an ID document and, if you can, proof the item is yours.',
    saveLink: 'Save this link to see or cancel your booking:',
    copy: 'Copy link',
    copied: 'Copied',
    calendar: 'Add to calendar',
    manageTitle: 'Your booking',
    status: { booked: 'Booked', collected: 'Collected', no_show: 'Missed', cancelled: 'Cancelled' } as Record<string, string>,
    cancel: 'Cancel booking',
    cancelAsk: 'Cancel this booking? The time slot will be released.',
    yesCancel: 'Yes, cancel',
    keep: 'Keep it',
    notFound: 'Booking not found.',
  },
```
Italian (`it.ts`):
```ts
  office: {
    stripTitle: "Trovati all'ufficio", stripLead: 'Registrati dal personale con una foto. Puoi prenotare il ritiro.',
    badge: "Registrato all'ufficio", registryBadge: 'Dal PDF del Comune', reserved: 'Ritiro prenotato',
    foundPlace: 'Trovato a', colour: 'Colore', date: 'Trovato il', recent: "Registrati di recente all'ufficio",
    notRecordedOffice: "non registrato nel PDF del Comune — usato per gli oggetti dell'ufficio",
    notFound: 'Questo oggetto non è più disponibile.',
  },
  colours: { black: 'Nero', white: 'Bianco', grey: 'Grigio', silver: 'Argento', gold: 'Oro', red: 'Rosso',
    orange: 'Arancione', yellow: 'Giallo', green: 'Verde', blue: 'Blu', purple: 'Viola', pink: 'Rosa',
    brown: 'Marrone', beige: 'Beige', multicolour: 'Multicolore' } as Record<string, string>,
  booking: {
    cta: 'Prenota il ritiro', day: 'Giorno', time: 'Orario', noSlots: 'Nessun orario libero in questo giorno.',
    name: 'Il tuo nome', contact: 'Email o telefono',
    ack: "Ho capito che allo sportello dovrò descrivere l'oggetto e mostrare un documento.",
    confirm: 'Conferma prenotazione', sending: 'Prenotazione…',
    slotTaken: 'Questo orario è appena stato preso — scegline un altro.',
    itemTaken: 'Qualcuno ha appena prenotato questo oggetto.', tooMany: 'Troppe prenotazioni. Riprova più tardi.',
    error: 'Prenotazione non riuscita. Riprova.', done: 'Ritiro prenotato', code: 'Codice prenotazione', when: 'Quando',
    bring: "Porta un documento d'identità e, se puoi, una prova che l'oggetto è tuo.",
    saveLink: 'Salva questo link per vedere o annullare la prenotazione:', copy: 'Copia link', copied: 'Copiato',
    calendar: 'Aggiungi al calendario', manageTitle: 'La tua prenotazione',
    status: { booked: 'Prenotato', collected: 'Ritirato', no_show: 'Non presentato', cancelled: 'Annullato' } as Record<string, string>,
    cancel: 'Annulla prenotazione', cancelAsk: "Annullare la prenotazione? L'orario tornerà libero.",
    yesCancel: 'Sì, annulla', keep: 'Mantieni', notFound: 'Prenotazione non trovata.',
  },
```
Spanish (`es.ts`):
```ts
  office: {
    stripTitle: 'Encontrados en la oficina', stripLead: 'Registrados por el personal con una foto. Puedes reservar la recogida.',
    badge: 'Registrado en la oficina', registryBadge: 'Del PDF del Ayuntamiento', reserved: 'Recogida reservada',
    foundPlace: 'Encontrado en', colour: 'Color', date: 'Encontrado el', recent: 'Registrados recientemente en la oficina',
    notRecordedOffice: 'no consta en el PDF del Ayuntamiento — se usa para los objetos de la oficina',
    notFound: 'Este objeto ya no está disponible.',
  },
  colours: { black: 'Negro', white: 'Blanco', grey: 'Gris', silver: 'Plateado', gold: 'Dorado', red: 'Rojo',
    orange: 'Naranja', yellow: 'Amarillo', green: 'Verde', blue: 'Azul', purple: 'Morado', pink: 'Rosa',
    brown: 'Marrón', beige: 'Beige', multicolour: 'Multicolor' } as Record<string, string>,
  booking: {
    cta: 'Reservar la recogida', day: 'Día', time: 'Hora', noSlots: 'No hay horas libres este día.',
    name: 'Tu nombre', contact: 'Email o teléfono',
    ack: 'Entiendo que en la ventanilla tendré que describir el objeto y mostrar un documento.',
    confirm: 'Confirmar reserva', sending: 'Reservando…', slotTaken: 'Esa hora acaba de ocuparse — elige otra.',
    itemTaken: 'Alguien acaba de reservar este objeto.', tooMany: 'Demasiadas reservas. Inténtalo más tarde.',
    error: 'La reserva ha fallado. Inténtalo de nuevo.', done: 'Recogida reservada', code: 'Código de reserva', when: 'Cuándo',
    bring: 'Trae un documento de identidad y, si puedes, una prueba de que el objeto es tuyo.',
    saveLink: 'Guarda este enlace para ver o cancelar tu reserva:', copy: 'Copiar enlace', copied: 'Copiado',
    calendar: 'Añadir al calendario', manageTitle: 'Tu reserva',
    status: { booked: 'Reservada', collected: 'Recogido', no_show: 'No presentado', cancelled: 'Cancelada' } as Record<string, string>,
    cancel: 'Cancelar reserva', cancelAsk: '¿Cancelar esta reserva? La hora quedará libre.',
    yesCancel: 'Sí, cancelar', keep: 'Mantener', notFound: 'Reserva no encontrada.',
  },
```
French (`fr.ts`):
```ts
  office: {
    stripTitle: 'Trouvés au bureau', stripLead: 'Enregistrés par le personnel avec une photo. Vous pouvez réserver le retrait.',
    badge: 'Enregistré au bureau', registryBadge: 'Du PDF de la Ville', reserved: 'Retrait réservé',
    foundPlace: 'Trouvé à', colour: 'Couleur', date: 'Trouvé le', recent: 'Enregistrés récemment au bureau',
    notRecordedOffice: "absent du PDF de la Ville — utilisé pour les objets du bureau",
    notFound: "Cet objet n'est plus disponible.",
  },
  colours: { black: 'Noir', white: 'Blanc', grey: 'Gris', silver: 'Argent', gold: 'Or', red: 'Rouge',
    orange: 'Orange', yellow: 'Jaune', green: 'Vert', blue: 'Bleu', purple: 'Violet', pink: 'Rose',
    brown: 'Marron', beige: 'Beige', multicolour: 'Multicolore' } as Record<string, string>,
  booking: {
    cta: 'Réserver le retrait', day: 'Jour', time: 'Heure', noSlots: 'Aucun créneau libre ce jour-là.',
    name: 'Votre nom', contact: 'E-mail ou téléphone',
    ack: "Je comprends que je devrai décrire l'objet et montrer une pièce d'identité au guichet.",
    confirm: 'Confirmer la réservation', sending: 'Réservation…', slotTaken: 'Ce créneau vient d’être pris — choisissez-en un autre.',
    itemTaken: "Quelqu'un vient de réserver cet objet.", tooMany: 'Trop de réservations. Réessayez plus tard.',
    error: 'La réservation a échoué. Réessayez.', done: 'Retrait réservé', code: 'Code de réservation', when: 'Quand',
    bring: "Apportez une pièce d'identité et, si possible, une preuve que l'objet vous appartient.",
    saveLink: 'Gardez ce lien pour voir ou annuler votre réservation :', copy: 'Copier le lien', copied: 'Copié',
    calendar: 'Ajouter au calendrier', manageTitle: 'Votre réservation',
    status: { booked: 'Réservé', collected: 'Retiré', no_show: 'Absent', cancelled: 'Annulé' } as Record<string, string>,
    cancel: 'Annuler la réservation', cancelAsk: 'Annuler cette réservation ? Le créneau sera libéré.',
    yesCancel: 'Oui, annuler', keep: 'Garder', notFound: 'Réservation introuvable.',
  },
```
German (`de.ts`):
```ts
  office: {
    stripTitle: 'Im Fundbüro abgegeben', stripLead: 'Vom Personal mit Foto erfasst. Du kannst die Abholung buchen.',
    badge: 'Im Fundbüro erfasst', registryBadge: 'Aus dem PDF der Stadt', reserved: 'Abholung gebucht',
    foundPlace: 'Gefunden in', colour: 'Farbe', date: 'Gefunden am', recent: 'Kürzlich im Fundbüro erfasst',
    notRecordedOffice: 'nicht im PDF der Stadt erfasst — für Fundbüro-Gegenstände genutzt',
    notFound: 'Dieser Gegenstand ist nicht mehr verfügbar.',
  },
  colours: { black: 'Schwarz', white: 'Weiß', grey: 'Grau', silver: 'Silber', gold: 'Gold', red: 'Rot',
    orange: 'Orange', yellow: 'Gelb', green: 'Grün', blue: 'Blau', purple: 'Lila', pink: 'Rosa',
    brown: 'Braun', beige: 'Beige', multicolour: 'Bunt' } as Record<string, string>,
  booking: {
    cta: 'Abholung buchen', day: 'Tag', time: 'Uhrzeit', noSlots: 'An diesem Tag ist nichts mehr frei.',
    name: 'Dein Name', contact: 'E-Mail oder Telefon',
    ack: 'Ich weiß, dass ich am Schalter den Gegenstand beschreiben und einen Ausweis zeigen muss.',
    confirm: 'Buchung bestätigen', sending: 'Wird gebucht…', slotTaken: 'Diese Uhrzeit wurde gerade vergeben — wähle eine andere.',
    itemTaken: 'Jemand hat diesen Gegenstand gerade gebucht.', tooMany: 'Zu viele Buchungen. Versuche es später.',
    error: 'Buchung fehlgeschlagen. Versuche es noch einmal.', done: 'Abholung gebucht', code: 'Buchungscode', when: 'Wann',
    bring: 'Bring einen Ausweis mit und, wenn möglich, einen Nachweis, dass der Gegenstand dir gehört.',
    saveLink: 'Speichere diesen Link, um die Buchung zu sehen oder zu stornieren:', copy: 'Link kopieren', copied: 'Kopiert',
    calendar: 'Zum Kalender hinzufügen', manageTitle: 'Deine Buchung',
    status: { booked: 'Gebucht', collected: 'Abgeholt', no_show: 'Nicht erschienen', cancelled: 'Storniert' } as Record<string, string>,
    cancel: 'Buchung stornieren', cancelAsk: 'Diese Buchung stornieren? Die Uhrzeit wird wieder frei.',
    yesCancel: 'Ja, stornieren', keep: 'Behalten', notFound: 'Buchung nicht gefunden.',
  },
```
Run `cd web && npx tsc -b` — expected: no errors.

- [ ] **Step 7: `web/src/components/OfficeCard.tsx`**

```tsx
import type { Item } from '../api'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'
import { SWATCH, type Colour } from '../lib/colours'
import { href } from '../lib/router'

/** One office-logged item in results: photo first, then what and where. */
export default function OfficeCard({ item }: { item: Item }) {
  const { t } = useI18n()
  const reserved = item.status === 'reserved'
  return (
    <a
      href={href(`item/${encodeURIComponent(item.id)}`)}
      data-testid="office-card"
      className="flex min-w-0 flex-col border-2 border-ink bg-card text-ink no-underline transition-transform hover:-translate-y-0.5 hover:text-ink"
    >
      <div className="relative aspect-[4/3] border-b-2 border-ink bg-manila">
        {item.photo_url && <img src={item.photo_url} alt="" loading="lazy" className="size-full object-cover" />}
        <span className="absolute top-2 left-2 bg-ink px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-card uppercase">
          {reserved ? t.office.reserved : t.office.badge}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <strong className="text-[16px] leading-snug">{item.descr}</strong>
        <span className="flex items-center gap-2 text-sm text-muted">
          {item.colour && (
            <span aria-hidden="true" className="inline-block size-3.5 rounded-full border border-ink" style={{ background: SWATCH[item.colour as Colour] }} />
          )}
          {t.categories[item.category] ?? item.category}
          {item.brand && ` · ${item.brand}`}
        </span>
        <span className="font-mono text-[13px]">
          {item.found_place} · {formatDate(item.date)}
        </span>
      </div>
    </a>
  )
}
```

- [ ] **Step 8: `web/src/components/OfficeStrip.tsx`**

```tsx
import type { Item } from '../api'
import { useI18n } from '../i18n'
import OfficeCard from './OfficeCard'

export default function OfficeStrip({ items }: { items: Item[] | undefined }) {
  const { t } = useI18n()
  if (!items?.length) return null
  return (
    <section aria-labelledby="office-strip" data-testid="office-strip" className="flex flex-col gap-3 border-2 border-ink bg-manila p-4">
      <div>
        <h2 id="office-strip" className="font-wide m-0 text-2xl font-black">{t.office.stripTitle}</h2>
        <p className="m-0 text-sm">{t.office.stripLead}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {items.map((it) => (
          <OfficeCard key={it.id} item={it} />
        ))}
      </div>
    </section>
  )
}
```
Integrate: in `pages/Search.tsx` `Results`, render `<OfficeStrip items={base?.office} />` directly after the `Refine` block and before the results `<section>`.

In `pages/Catalogue.tsx`:
  - `const office = params.get('source') === 'office'`; include it in `key` (`const key = [...FIELDS.map((k) => filters[k]), office].join('|')`).
  - Add state `const [near, setNear] = useState<Item[]>([])`.
  - In `load`: `const p: ItemsParams = { ...filters, limit: PAGE, offset, ...(office ? { source: 'office' as const } : {}) }`; in the success branch, after `setTotal`, add `if (offset === 0) setNear(r.office ?? [])`.
  - Above `{items.map(...)}` render `{!office && <OfficeStrip items={near} />}`.
  - Replace the list with
    ```tsx
    {office ? (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {items.map((it) => <OfficeCard key={it.id} item={it} />)}
      </div>
    ) : (
      items.map((it) => <ItemTag key={it.id} item={it} />)
    )}
    ```
  - When `office`, the h1 shows `t.office.recent` instead of `t.nav.catalogue` while `total === null`.
  - `FilterPanel` navigates with the filter fields only; make it keep `source=office` when present (pass `office` as a prop and add `source: office ? 'office' : undefined` to the params it builds with `href('catalogue', …)`).

In `ItemTag.tsx`, add a quiet badge after the date/page column: `<span className="font-mono text-[11px] uppercase text-muted">{t.office.registryBadge}</span>`.

- [ ] **Step 9: `Understood.tsx`** — accept `hasOffice?: boolean`; for `ignored` keys `colour`/`place`, when `hasOffice` use `t.office.notRecordedOffice` instead of `t.search.notRecorded`; also render a chip for `interpreted.colour` (`t.colours[colour]`) and `interpreted.place` when present. Pass `hasOffice={!!base?.office?.length}` from `Results`.

- [ ] **Step 10: `Home.tsx`** — under the "Browse by type" category links, add `<a href={href('catalogue', { source: 'office' })} className="…same style as openCatalogue link…">{t.office.recent}</a>`. Keep the existing 15 `#/catalogue?category=` links untouched (an e2e test counts them).

- [ ] **Step 11: `web/src/components/BookingPanel.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ApiError, bookItem, getSlots, type BookingResult, type Item, type Slot } from '../api'
import { useI18n } from '../i18n'
import { pickupIcs } from '../lib/ics'
import { href } from '../lib/router'

const WEEKDAYS_OPEN = new Set([1, 2, 3, 4, 5]) // Mon–Fri; the server is the authority

function nextDays(n: number) {
  const out: string[] = []
  const d = new Date()
  for (let i = 1; out.length < n && i <= 14; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
    if (WEEKDAYS_OPEN.has(x.getDay())) {
      out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`)
    }
  }
  return out
}

export default function BookingPanel({ item, onBooked }: { item: Item; onBooked: () => void }) {
  const { t, lang } = useI18n()
  const days = useMemo(() => nextDays(10), [])
  const [day, setDay] = useState(days[0])
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<BookingResult | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    setSlots(null)
    getSlots(day).then((r) => live && setSlots(r.slots), () => live && setSlots([]))
    return () => {
      live = false
    }
  }, [day, reload])

  const label = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!slot) return
    setBusy(true)
    setError(null)
    try {
      setDone(await bookItem(item.id, { name, contact, slot_start: slot }))
      onBooked()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : ''
      if (err instanceof ApiError && err.status === 409 && msg.includes('slot_taken')) {
        setError(t.booking.slotTaken)
        setSlot(null)
        setReload((n) => n + 1)
      } else if (err instanceof ApiError && err.status === 409) setError(t.booking.itemTaken)
      else if (err instanceof ApiError && err.status === 429) setError(t.booking.tooMany)
      else setError(t.booking.error)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Confirmation item={item} done={done} />

  const field = 'min-h-11 border-2 border-ink bg-card px-3 text-base'
  return (
    <form onSubmit={submit} data-testid="booking-panel" className="flex flex-col gap-4 border-2 border-ink bg-card p-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 font-mono text-xs font-semibold uppercase">{t.booking.day}</legend>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button key={d} type="button" data-day={d} aria-pressed={d === day} onClick={() => { setDay(d); setSlot(null) }}
              className={`min-h-11 flex-none border-2 border-ink px-3 font-semibold ${d === day ? 'bg-ink text-card' : 'bg-card'}`}>
              {label(d)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 font-mono text-xs font-semibold uppercase">{t.booking.time}</legend>
        {slots === null && <p className="m-0 font-mono text-sm">…</p>}
        {slots && slots.filter((s) => s.free).length === 0 && <p className="m-0">{t.booking.noSlots}</p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
          {slots?.filter((s) => s.free).map((s) => (
            <button key={s.start} type="button" data-testid="slot" aria-pressed={s.start === slot} onClick={() => setSlot(s.start)}
              className={`min-h-11 border-2 border-ink font-mono ${s.start === slot ? 'bg-ink text-card' : 'bg-card'}`}>
              {s.start.slice(11)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 font-semibold">
        {t.booking.name}
        <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        {t.booking.contact}
        <input required minLength={3} maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} className={field} autoComplete="email" />
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" required checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 size-5" />
        <span>{t.booking.ack}</span>
      </label>
      {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-paper px-3 py-2 font-semibold">{error}</p>}
      <button type="submit" disabled={!slot || busy} className="min-h-12 border-2 border-ink bg-signal px-5 font-bold disabled:opacity-50">
        {busy ? t.booking.sending : t.booking.confirm}
      </button>
    </form>
  )
}

function Confirmation({ item, done }: { item: Item; done: BookingResult }) {
  const { t, lang } = useI18n()
  const [copied, setCopied] = useState(false)
  const manage = `${location.origin}${location.pathname}${href(`booking/${done.manage_token}`)}`
  const when = new Date(done.slot_start).toLocaleString(lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const ics = () => {
    const url = URL.createObjectURL(pickupIcs({ code: done.code, slotStart: done.slot_start, title: `${t.booking.done}: ${item.descr}`, location: 'Ufficio Oggetti Rinvenuti, Roma', url: manage }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ritrovato-${done.code}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section data-testid="booking-done" aria-live="polite" className="flex flex-col gap-3 border-2 border-ink bg-manila p-5">
      <h3 className="font-wide m-0 text-2xl font-black">{t.booking.done}</h3>
      <div>
        <span className="font-mono text-xs font-semibold uppercase">{t.booking.code}</span>
        <p data-testid="booking-code" className="m-0 font-mono text-[44px] leading-none font-semibold">{done.code}</p>
      </div>
      <p className="m-0"><b>{t.booking.when}:</b> {when}</p>
      <p className="m-0">{t.booking.bring}</p>
      <p className="m-0 text-sm">{t.booking.saveLink}</p>
      <div className="flex flex-wrap gap-2">
        <input readOnly value={manage} aria-label={t.booking.saveLink} className="min-h-11 min-w-0 flex-1 border-2 border-ink bg-card px-2 font-mono text-xs" />
        <button type="button" onClick={() => navigator.clipboard?.writeText(manage).then(() => setCopied(true))} className="min-h-11 border-2 border-ink bg-card px-3 font-semibold">
          {copied ? t.booking.copied : t.booking.copy}
        </button>
        <button type="button" onClick={ics} className="min-h-11 border-2 border-ink bg-card px-3 font-semibold">{t.booking.calendar}</button>
      </div>
    </section>
  )
}
```
Note: the client-side day list is only a hint (Mon–Fri); the server rejects days outside hours and `getSlots` returns the truth (an empty day shows `noSlots`).

- [ ] **Step 12: `web/src/pages/OfficeItemPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { getItem, type Item } from '../api'
import BookingPanel from '../components/BookingPanel'
import { ArrowLeft } from '../components/Icons'
import Pickup from '../components/Pickup'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'
import { href } from '../lib/router'

export default function OfficeItemPage({ id }: { id: string }) {
  const { t } = useI18n()
  const [item, setItem] = useState<Item | null | 'missing'>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    getItem(id).then(setItem, () => setItem('missing'))
  }, [id])

  const back = (
    <button type="button" onClick={() => (history.length > 1 ? history.back() : (location.hash = href('catalogue')))}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start border-0 bg-transparent p-0 text-[15px] font-bold text-ink hover:text-signal-ink">
      <ArrowLeft size={18} />
      {t.item.back}
    </button>
  )
  if (item === null) return <div className="pt-8">{back}</div>
  if (item === 'missing') {
    return (
      <div className="flex flex-col gap-4 pt-8">
        {back}
        <h1 className="font-wide m-0 text-3xl font-black">{t.office.notFound}</h1>
      </div>
    )
  }
  const dt = 'font-mono text-[11px] font-semibold tracking-[0.08em] uppercase'
  return (
    <div className="flex flex-col gap-4 pt-7">
      {back}
      <div className="flex flex-wrap items-start gap-12">
        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          {item.photo_url && <img src={item.photo_url} alt={item.descr} className="w-full border-2 border-ink shadow-[10px_10px_0_#111]" />}
          <span className="self-start bg-ink px-2 py-1 font-mono text-xs font-semibold text-card uppercase">{t.office.badge}</span>
          <h1 className="font-wide m-0 text-[32px] leading-tight font-black">{item.descr}</h1>
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 font-mono">
            <div><dt className={dt}>{t.item.type}</dt><dd className="m-0 mt-1">{t.categories[item.category] ?? item.category}{item.brand && ` · ${item.brand}`}</dd></div>
            {item.colour && <div><dt className={dt}>{t.office.colour}</dt><dd className="m-0 mt-1">{t.colours[item.colour] ?? item.colour}</dd></div>}
            <div><dt className={dt}>{t.office.foundPlace}</dt><dd className="m-0 mt-1">{item.found_place}</dd></div>
            <div><dt className={dt}>{t.office.date}</dt><dd className="m-0 mt-1">{formatDate(item.date)}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="collect" className="flex min-w-0 flex-[999_1_460px] flex-col gap-6">
          <h2 id="collect" className="font-wide m-0 text-[40px] leading-none font-black">{t.pickup.title}</h2>
          {item.status === 'reserved' && !open ? (
            <p className="m-0 border-2 border-dashed border-ink p-4 font-semibold">{t.office.reserved}</p>
          ) : open ? (
            <BookingPanel item={item} onBooked={() => undefined} />
          ) : (
            <button type="button" data-testid="book-cta" onClick={() => setOpen(true)} className="min-h-12 self-start border-2 border-ink bg-signal px-6 text-lg font-bold">
              {t.booking.cta}
            </button>
          )}
          <Pickup />
        </section>
      </div>
    </div>
  )
}
```
`ItemPage.tsx` is not changed for routing; `App.tsx` picks the page (Step 14).

- [ ] **Step 13: `web/src/pages/ManageBooking.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { cancelBooking, getBooking, type Booking } from '../api'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'

export default function ManageBooking({ token }: { token: string }) {
  const { t, lang } = useI18n()
  const [b, setB] = useState<Booking | null | 'missing'>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    getBooking(token).then(setB, () => setB('missing'))
  }, [token])

  if (b === null) return <p className="pt-8 font-mono">…</p>
  if (b === 'missing') return <h1 className="font-wide pt-8 text-3xl font-black">{t.booking.notFound}</h1>

  const when = new Date(b.slot_start).toLocaleString(lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  async function cancel() {
    try {
      setB(await cancelBooking(token))
      setAsking(false)
    } catch {
      setError(true)
    }
  }
  return (
    <div data-testid="manage-booking" className="flex max-w-2xl flex-col gap-4 pt-8">
      <h1 className="font-wide m-0 text-[40px] leading-none font-black">{t.booking.manageTitle}</h1>
      <p className="m-0 font-mono text-[40px] font-semibold">{b.code}</p>
      <p data-testid="booking-status" className="m-0 self-start bg-ink px-3 py-1 font-bold text-card">{t.booking.status[b.status] ?? b.status}</p>
      <p className="m-0"><b>{t.booking.when}:</b> {when}</p>
      <p className="m-0">{b.item.descr} · {b.item.found_place} · {formatDate(b.item.date)}</p>
      {b.status === 'booked' && !asking && (
        <button type="button" onClick={() => setAsking(true)} className="min-h-11 self-start border-2 border-ink bg-card px-4 font-bold">{t.booking.cancel}</button>
      )}
      {asking && (
        <div role="alertdialog" aria-label={t.booking.cancel} className="flex flex-col gap-3 border-2 border-ink bg-manila p-4">
          <p className="m-0">{t.booking.cancelAsk}</p>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="min-h-11 border-2 border-ink bg-signal px-4 font-bold">{t.booking.yesCancel}</button>
            <button type="button" onClick={() => setAsking(false)} className="min-h-11 border-2 border-ink bg-card px-4 font-bold">{t.booking.keep}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="m-0">{t.booking.error}</p>}
    </div>
  )
}
```

- [ ] **Step 14: `App.tsx` routing** — import `OfficeItemPage` and `ManageBooking`; replace the item line with:

```tsx
        {route.name === 'item' && (route.id.startsWith('office-') ? <OfficeItemPage id={route.id} /> : <ItemPage id={route.id} />)}
        {route.name === 'booking' && <ManageBooking token={route.token} />}
```
(Task 7 adds the operator branch.)

- [ ] **Step 15: Verify** — `cd web && npm run build && npm run lint` → both pass. Then manual check with the dev servers: `cd server && .venv/Scripts/python.exe -m app.operators seed-demo --password demo-pass-123` and `.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000`, `cd web && npm run dev`; open `http://localhost:5173/#/search?q=black%20wallet` → office strip shows; open an office card → book → code shown → manage link shows "Booked" → cancel → "Cancelled". Then run the existing e2e: `cd web && npx playwright test e2e/app.spec.ts --project=desktop` → same pass count as before the change (note: the README in STATUS mentions one stale count assert; anything that passed before must pass now).

- [ ] **Step 16: Commit**

```bash
git add web/src
git commit -m "feat(web): office items in results, item page with pickup booking, manage link"
```

---

### Task 7: Operator back-office UI

**Files:**
- Create: `web/src/operator/strings.ts`, `web/src/operator/OperatorApp.tsx`, `web/src/operator/Login.tsx`, `web/src/operator/Today.tsx`, `web/src/operator/Intake.tsx`, `web/src/operator/ItemForm.tsx`, `web/src/operator/Inventory.tsx`, `web/src/operator/Bookings.tsx`, `web/src/operator/BookingRow.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: Task 6 `api.ts` operator helpers, `Route` `{ name: 'operator', page, params }`, `lib/colours.ts` `CATEGORIES/COLOURS/SWATCH`, `useI18n()` (`lang`, `t.categories`, `t.colours`).
- Produces: `OperatorApp({ page, params })` default export.

- [ ] **Step 1: `web/src/operator/strings.ts`**

```ts
import { useI18n } from '../i18n'

const en = {
  title: 'Back-office',
  logout: 'Log out',
  nav: { today: 'Today', new: 'Log item', items: 'Inventory', bookings: 'Bookings' },
  login: { title: 'Operator login', username: 'Username', password: 'Password', submit: 'Log in', wrong: 'Wrong username or password.', limited: 'Too many attempts. Wait 10 minutes.' },
  today: { title: 'Today', none: 'No bookings today.', available: 'Available items', week: 'Bookings this week', log: '+ Log found item' },
  status: { available: 'Available', reserved: 'Reserved', returned: 'Returned', discarded: 'Discarded' } as Record<string, string>,
  bstatus: { booked: 'Booked', collected: 'Collected', no_show: 'No-show', cancelled: 'Cancelled' } as Record<string, string>,
  act: { collected: 'Collected', no_show: 'No-show', cancel: 'Cancel', confirm: 'Confirm', back: 'Back' },
  form: {
    photo: 'Photo', takePhoto: 'Take or choose a photo', replacePhoto: 'Replace photo', reading: 'Reading the photo…',
    aiFailed: 'Could not read the photo. Fill in the fields.', suggested: 'suggested',
    category: 'Category', brand: 'Brand', colour: 'Colour', none: '—', descr: 'Description', place: 'Where found', date: 'Date found',
    save: 'Save', saving: 'Saving…', saved: (id: string) => `Logged as ${id}`, error: 'Save failed. Check the fields and try again.',
  },
  inventory: { title: 'Inventory', all: 'All', search: 'Search', empty: 'No items.', edit: 'Edit', markReturned: 'Mark returned', discard: 'Discard', close: 'Close', more: 'Show more' },
  bookings: { title: 'Bookings', date: 'Date', empty: 'No bookings on this day.', free: 'free' },
  session: 'Your session expired. Log in again.',
}
export type OpStrings = typeof en

const it: OpStrings = {
  title: 'Back-office',
  logout: 'Esci',
  nav: { today: 'Oggi', new: 'Registra oggetto', items: 'Inventario', bookings: 'Prenotazioni' },
  login: { title: 'Accesso operatore', username: 'Utente', password: 'Password', submit: 'Entra', wrong: 'Utente o password errati.', limited: 'Troppi tentativi. Attendi 10 minuti.' },
  today: { title: 'Oggi', none: 'Nessuna prenotazione oggi.', available: 'Oggetti disponibili', week: 'Prenotazioni della settimana', log: '+ Registra oggetto trovato' },
  status: { available: 'Disponibile', reserved: 'Prenotato', returned: 'Restituito', discarded: 'Eliminato' },
  bstatus: { booked: 'Prenotato', collected: 'Ritirato', no_show: 'Non presentato', cancelled: 'Annullato' },
  act: { collected: 'Ritirato', no_show: 'Non presentato', cancel: 'Annulla', confirm: 'Conferma', back: 'Indietro' },
  form: {
    photo: 'Foto', takePhoto: 'Scatta o scegli una foto', replacePhoto: 'Sostituisci foto', reading: 'Lettura della foto…',
    aiFailed: 'Impossibile leggere la foto. Compila i campi.', suggested: 'suggerito',
    category: 'Categoria', brand: 'Marca', colour: 'Colore', none: '—', descr: 'Descrizione', place: 'Dove è stato trovato', date: 'Data del ritrovamento',
    save: 'Salva', saving: 'Salvataggio…', saved: (id: string) => `Registrato come ${id}`, error: 'Salvataggio non riuscito. Controlla i campi e riprova.',
  },
  inventory: { title: 'Inventario', all: 'Tutti', search: 'Cerca', empty: 'Nessun oggetto.', edit: 'Modifica', markReturned: 'Segna restituito', discard: 'Elimina', close: 'Chiudi', more: 'Mostra altri' },
  bookings: { title: 'Prenotazioni', date: 'Data', empty: 'Nessuna prenotazione in questo giorno.', free: 'libero' },
  session: 'Sessione scaduta. Accedi di nuovo.',
}

export function useOpT(): OpStrings {
  const { lang } = useI18n()
  return lang === 'it' ? it : en
}
```

- [ ] **Step 2: `web/src/operator/OperatorApp.tsx`** — shell, session guard, nav, 401 handling:

```tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError, opLogout, opMe, type Operator } from '../api'
import { href, navigate } from '../lib/router'
import Bookings from './Bookings'
import Intake from './Intake'
import Inventory from './Inventory'
import Login from './Login'
import { useOpT } from './strings'
import Today from './Today'

type Page = 'today' | 'login' | 'new' | 'items' | 'bookings'

/** Any operator call that fails with 401 goes through this: back to login with a note. */
const Guard = createContext<(e: unknown) => void>(() => undefined)
export const useGuard = () => useContext(Guard)

export default function OperatorApp({ page, params }: { page: Page; params: URLSearchParams }) {
  const t = useOpT()
  const [me, setMe] = useState<Operator | null | 'out'>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    opMe().then(setMe, () => setMe('out'))
  }, [page])

  const guard = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setExpired(true)
      setMe('out')
    }
  }, [])

  useEffect(() => {
    if (me === 'out' && page !== 'login') navigate(href('operator/login'))
  }, [me, page])

  if (page === 'login' || me === 'out') {
    return <Login expired={expired} onIn={(op) => { setExpired(false); setMe(op); navigate(href('operator')) }} />
  }
  if (me === null) return <p className="p-6 font-mono">…</p>

  const link = (p: Page, label: string) => (
    <a href={href(p === 'today' ? 'operator' : `operator/${p}`)} aria-current={page === p ? 'page' : undefined}
      className={`py-2 font-semibold no-underline ${page === p ? 'underline decoration-[3px] underline-offset-[6px]' : ''}`}>
      {label}
    </a>
  )
  return (
    <Guard.Provider value={guard}>
      <div className="mx-auto box-border max-w-[1200px] px-4 pb-16 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink py-4">
          <span className="font-widest text-lg font-black tracking-[0.04em]">RITROVATO · {t.title}</span>
          <nav aria-label={t.title} className="flex flex-wrap gap-5 text-[15px]">
            {link('today', t.nav.today)}
            {link('new', t.nav.new)}
            {link('items', t.nav.items)}
            {link('bookings', t.nav.bookings)}
          </nav>
          <span className="flex items-center gap-3 text-sm">
            {me.display_name}
            <button type="button" onClick={() => opLogout().finally(() => setMe('out'))} className="min-h-10 border-2 border-ink bg-card px-3 font-semibold">
              {t.logout}
            </button>
          </span>
        </header>
        <main className="pt-6">
          {page === 'today' && <Today />}
          {page === 'new' && <Intake />}
          {page === 'items' && <Inventory params={params} />}
          {page === 'bookings' && <Bookings params={params} />}
        </main>
      </div>
    </Guard.Provider>
  )
}
```

- [ ] **Step 3: `web/src/operator/Login.tsx`**

```tsx
import { useState } from 'react'
import { ApiError, opLogin, type Operator } from '../api'
import { useOpT } from './strings'

export default function Login({ expired, onIn }: { expired: boolean; onIn: (op: Operator) => void }) {
  const t = useOpT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(expired ? t.session : null)
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      onIn(await opLogin(username, password))
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t.login.limited : t.login.wrong)
    } finally {
      setBusy(false)
    }
  }
  const field = 'min-h-11 border-2 border-ink bg-card px-3 text-base'
  return (
    <form onSubmit={submit} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 px-4">
      <h1 className="font-wide m-0 text-3xl font-black">{t.login.title}</h1>
      <label className="flex flex-col gap-1 font-semibold">{t.login.username}
        <input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">{t.login.password}
        <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-card px-3 py-2">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 border-2 border-ink bg-signal font-bold">{t.login.submit}</button>
    </form>
  )
}
```

- [ ] **Step 4: `web/src/operator/BookingRow.tsx`** — shared by Today and Bookings:

```tsx
import { useState } from 'react'
import { opPatchBooking, type DayBooking } from '../api'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export default function BookingRow({ b, onChange }: { b: DayBooking; onChange: (b: DayBooking) => void }) {
  const t = useOpT()
  const guard = useGuard()
  const [asking, setAsking] = useState<null | 'collected' | 'no_show' | 'cancelled'>(null)
  const act = (s: 'collected' | 'no_show' | 'cancelled') =>
    opPatchBooking(b.id, s).then(onChange, guard).finally(() => setAsking(null))
  const btn = 'min-h-10 border-2 border-ink bg-card px-3 text-sm font-semibold'
  return (
    <li data-testid="booking-row" className="flex flex-wrap items-center gap-4 border-2 border-ink bg-card p-3">
      <span className="font-mono text-lg font-semibold">{b.slot_start.slice(11)}</span>
      {b.item.photo_url && <img src={b.item.photo_url} alt="" className="size-14 border-2 border-ink object-cover" />}
      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
        <b className="font-mono">{b.code}</b>
        <span>{b.name} · {b.contact}</span>
        <span className="text-sm text-muted">{b.item.descr}</span>
      </span>
      <span className="font-mono text-xs uppercase">{t.bstatus[b.status]}</span>
      {b.status === 'booked' && !asking && (
        <span className="flex gap-2">
          <button type="button" className={`${btn} bg-signal`} onClick={() => act('collected')}>{t.act.collected}</button>
          <button type="button" className={btn} onClick={() => setAsking('no_show')}>{t.act.no_show}</button>
          <button type="button" className={btn} onClick={() => setAsking('cancelled')}>{t.act.cancel}</button>
        </span>
      )}
      {asking && (
        <span className="flex gap-2">
          <button type="button" className={`${btn} bg-signal`} onClick={() => act(asking)}>{t.act.confirm}: {asking === 'no_show' ? t.act.no_show : t.act.cancel}</button>
          <button type="button" className={btn} onClick={() => setAsking(null)}>{t.act.back}</button>
        </span>
      )}
    </li>
  )
}
```
(Collected needs no confirm — it is the expected action at the desk; destructive ones get an in-page confirm.)

- [ ] **Step 5: `web/src/operator/Today.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { opDayBookings, opListItems, type DayBooking } from '../api'
import { href } from '../lib/router'
import BookingRow from './BookingRow'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Today() {
  const t = useOpT()
  const guard = useGuard()
  const [list, setList] = useState<DayBooking[] | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [week, setWeek] = useState<number | null>(null)

  useEffect(() => {
    const now = new Date()
    opDayBookings(isoDay(now)).then(setList, guard)
    opListItems({ status: 'available', limit: 1 }).then((r) => setAvailable(r.total), guard)
    const days = Array.from({ length: 7 }, (_, i) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)))
    Promise.all(days.map(opDayBookings)).then((all) => setWeek(all.flat().filter((b) => b.status === 'booked').length), guard)
  }, [guard])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-wide m-0 text-4xl font-black">{t.today.title}</h1>
        <a href={href('operator/new')} className="min-h-12 border-2 border-ink bg-signal px-5 py-3 text-lg font-bold text-ink no-underline">{t.today.log}</a>
      </div>
      <dl className="m-0 flex flex-wrap gap-6 font-mono">
        <div><dt className="text-xs uppercase">{t.today.available}</dt><dd data-testid="count-available" className="m-0 text-3xl font-semibold">{available ?? '…'}</dd></div>
        <div><dt className="text-xs uppercase">{t.today.week}</dt><dd className="m-0 text-3xl font-semibold">{week ?? '…'}</dd></div>
      </dl>
      {list && list.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.today.none}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list?.map((b) => <BookingRow key={b.id} b={b} onChange={(nb) => setList((l) => l?.map((x) => (x.id === nb.id ? nb : x)) ?? null)} />)}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: `web/src/operator/ItemForm.tsx`** — shared by intake and edit drawer:

```tsx
import { useState } from 'react'
import { opDraft, type Draft, type ItemFields } from '../api'
import { useI18n } from '../i18n'
import { CATEGORIES, COLOURS } from '../lib/colours'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export type FormValue = ItemFields & { draft_id?: string }
const today = () => new Date().toISOString().slice(0, 10)
export const emptyForm = (): FormValue => ({ category: '', brand: null, colour: null, descr: '', found_place: '', found_at: today() })

const PLACES_KEY = 'ritrovato.op.places'
export function recentPlaces(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PLACES_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
export function rememberPlace(p: string) {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify([p, ...recentPlaces().filter((x) => x !== p)].slice(0, 12)))
  } catch {
    // datalist just stays shorter
  }
}

export default function ItemForm({ initial, photoUrl, busy, submitLabel, onSubmit }: {
  initial: FormValue
  photoUrl: string | null
  busy: boolean
  submitLabel: string
  onSubmit: (v: FormValue) => void
}) {
  const t = useOpT()
  const { t: pub } = useI18n()
  const guard = useGuard()
  const [v, setV] = useState<FormValue>(initial)
  const [photo, setPhoto] = useState<string | null>(photoUrl)
  const [reading, setReading] = useState(false)
  const [aiFailed, setAiFailed] = useState(false)
  const [suggested, setSuggested] = useState<Set<keyof ItemFields>>(new Set())

  const set = <K extends keyof FormValue>(k: K, val: FormValue[K]) => {
    setV((x) => ({ ...x, [k]: val }))
    setSuggested((s) => { const n = new Set(s); n.delete(k as keyof ItemFields); return n })
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setReading(true)
    setAiFailed(false)
    setPhoto(URL.createObjectURL(file))
    try {
      const d: Draft = await opDraft(file)
      setV((x) => {
        const s = d.suggested
        const next = { ...x, draft_id: d.draft_id }
        if (!s) return next
        const filled = new Set<keyof ItemFields>()
        if (s.category && !x.category) { next.category = s.category; filled.add('category') }
        if (s.brand && !x.brand) { next.brand = s.brand; filled.add('brand') }
        if (s.colour && !x.colour) { next.colour = s.colour; filled.add('colour') }
        if (s.descr && !x.descr) { next.descr = s.descr; filled.add('descr') }
        setSuggested(filled)
        return next
      })
      if (!d.suggested) setAiFailed(true)
    } catch (e) {
      guard(e)
      setAiFailed(true)
      setPhoto(photoUrl)
    } finally {
      setReading(false)
    }
  }

  const tag = (k: keyof ItemFields) => suggested.has(k) && <span className="ml-2 bg-manila px-1.5 font-mono text-[11px] uppercase">{t.form.suggested}</span>
  const field = 'min-h-11 w-full border-2 border-ink bg-card px-3 text-base'
  const label = 'flex flex-col gap-1 font-semibold'
  return (
    <form
      data-testid="item-form"
      onSubmit={(e) => { e.preventDefault(); rememberPlace(v.found_place.trim()); onSubmit(v) }}
      className="flex max-w-2xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t.form.photo}</span>
        {photo && <img src={photo} alt="" className="max-h-72 self-start border-2 border-ink object-contain" />}
        <label className="min-h-11 cursor-pointer self-start border-2 border-ink bg-card px-4 py-2 font-semibold">
          {photo ? t.form.replacePhoto : t.form.takePhoto}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" data-testid="photo-input"
            onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {reading && <p className="m-0 animate-pulse font-mono text-sm" data-testid="reading">{t.form.reading}</p>}
        {aiFailed && <p className="m-0 text-sm">{t.form.aiFailed}</p>}
      </div>
      <fieldset disabled={reading} className="m-0 flex flex-col gap-4 border-0 p-0">
        <label className={label}><span>{t.form.category}{tag('category')}</span>
          <select required value={v.category} onChange={(e) => set('category', e.target.value)} className={field}>
            <option value="" disabled>{t.form.none}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{pub.categories[c] ?? c}</option>)}
          </select>
        </label>
        <label className={label}><span>{t.form.brand}{tag('brand')}</span>
          <input maxLength={40} value={v.brand ?? ''} onChange={(e) => set('brand', e.target.value || null)} className={field} />
        </label>
        <label className={label}><span>{t.form.colour}{tag('colour')}</span>
          <select value={v.colour ?? ''} onChange={(e) => set('colour', e.target.value || null)} className={field}>
            <option value="">{t.form.none}</option>
            {COLOURS.map((c) => <option key={c} value={c}>{pub.colours[c] ?? c}</option>)}
          </select>
        </label>
        <label className={label}><span>{t.form.descr}{tag('descr')}</span>
          <textarea required minLength={3} maxLength={500} rows={3} value={v.descr} onChange={(e) => set('descr', e.target.value)} className={`${field} py-2`} />
        </label>
        <label className={label}>{t.form.place}
          <input required minLength={2} maxLength={120} list="op-places" value={v.found_place} onChange={(e) => set('found_place', e.target.value)} className={field} />
          <datalist id="op-places">{recentPlaces().map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <label className={label}>{t.form.date}
          <input required type="date" max={today()} value={v.found_at} onChange={(e) => set('found_at', e.target.value)} className={field} />
        </label>
        <button type="submit" disabled={busy || reading} className="min-h-12 self-start border-2 border-ink bg-signal px-6 text-lg font-bold">
          {busy ? t.form.saving : submitLabel}
        </button>
      </fieldset>
    </form>
  )
}
```

- [ ] **Step 7: `web/src/operator/Intake.tsx`**

```tsx
import { useState } from 'react'
import { opCreateItem } from '../api'
import ItemForm, { emptyForm } from './ItemForm'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export default function Intake() {
  const t = useOpT()
  const guard = useGuard()
  const [round, setRound] = useState(0) // remounts an empty form after each save
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-wide m-0 text-4xl font-black">{t.nav.new}</h1>
      {toast && <p role="status" data-testid="toast" className="m-0 self-start bg-ink px-4 py-2 font-bold text-card">{toast}</p>}
      {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-card px-3 py-2">{t.form.error}</p>}
      <ItemForm key={round} initial={emptyForm()} photoUrl={null} busy={busy} submitLabel={t.form.save}
        onSubmit={async (v) => {
          setBusy(true)
          setError(false)
          try {
            const it = await opCreateItem({ ...v, brand: v.brand?.trim() || null })
            setToast(t.form.saved(it.id))
            setRound((n) => n + 1)
            window.scrollTo({ top: 0 })
          } catch (e) {
            guard(e)
            setError(true)
          } finally {
            setBusy(false)
          }
        }} />
    </div>
  )
}
```

- [ ] **Step 8: `web/src/operator/Inventory.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { officeNumber, opListItems, opPatchItem, type OperatorItem } from '../api'
import { useI18n } from '../i18n'
import { CATEGORIES } from '../lib/colours'
import { formatDate } from '../lib/items'
import ItemForm from './ItemForm'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

const STATUSES = ['available', 'reserved', 'returned', 'discarded'] as const
const PAGE = 50

export default function Inventory({ params }: { params: URLSearchParams }) {
  const t = useOpT()
  const { t: pub } = useI18n()
  const guard = useGuard()
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [data, setData] = useState<{ items: OperatorItem[]; total: number } | null>(null)
  const [editing, setEditing] = useState<OperatorItem | null>(null)
  const [busy, setBusy] = useState(false)

  const load = (offset = 0) =>
    opListItems({ status, category, q, limit: PAGE, offset }).then(
      (r) => setData((d) => (offset && d ? { items: [...d.items, ...r.items], total: r.total } : r)),
      guard,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [status, category])

  const replace = (it: OperatorItem) => {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? it : x)) })
    setEditing(null)
  }
  const field = 'min-h-11 border-2 border-ink bg-card px-3'
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-wide m-0 text-4xl font-black">{t.inventory.title}</h1>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load() }}>
        <select aria-label="status" value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
          <option value="">{t.inventory.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
        </select>
        <select aria-label="category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
          <option value="">{t.inventory.all}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{pub.categories[c] ?? c}</option>)}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.inventory.search} className={`${field} flex-1`} />
        <button type="submit" className="min-h-11 border-2 border-ink bg-card px-4 font-semibold">{t.inventory.search}</button>
      </form>
      {data && data.items.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.inventory.empty}</p>}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
        {data?.items.map((it) => (
          <li key={it.id} data-testid="inventory-item" className="flex flex-col border-2 border-ink bg-card">
            {it.photo_url && <img src={it.photo_url} alt="" className="aspect-[4/3] w-full border-b-2 border-ink object-cover" />}
            <div className="flex flex-col gap-1 p-3">
              <span className="font-mono text-xs uppercase">{it.id} · {t.status[it.status]}</span>
              <b>{it.descr}</b>
              <span className="text-sm text-muted">{it.found_place} · {formatDate(it.date)}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(it)} className="min-h-10 border-2 border-ink px-3 text-sm font-semibold">{t.inventory.edit}</button>
                {(it.status === 'available' || it.status === 'reserved') && (
                  <>
                    <button type="button" onClick={() => opPatchItem(officeNumber(it.id), { status: 'returned' }).then(replace, guard)} className="min-h-10 border-2 border-ink px-3 text-sm font-semibold">{t.inventory.markReturned}</button>
                    <button type="button" onClick={() => opPatchItem(officeNumber(it.id), { status: 'discarded' }).then(replace, guard)} className="min-h-10 border-2 border-ink px-3 text-sm font-semibold">{t.inventory.discard}</button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data && data.total > data.items.length && (
        <button type="button" onClick={() => load(data.items.length)} className="min-h-11 self-start border-2 border-ink bg-card px-4 font-semibold">{t.inventory.more}</button>
      )}
      {editing && (
        <div role="dialog" aria-modal="true" aria-label={t.inventory.edit} className="fixed inset-0 z-10 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l-2 border-ink bg-paper p-5">
            <button type="button" onClick={() => setEditing(null)} className="mb-4 min-h-10 border-2 border-ink bg-card px-3 font-semibold">{t.inventory.close}</button>
            <ItemForm
              initial={{ category: editing.category, brand: editing.brand, colour: editing.colour, descr: editing.descr, found_place: editing.found_place ?? '', found_at: editing.date }}
              photoUrl={editing.photo_url}
              busy={busy}
              submitLabel={t.form.save}
              onSubmit={(v) => {
                setBusy(true)
                opPatchItem(officeNumber(editing.id), { ...v, brand: v.brand?.trim() || null }).then(replace, guard).finally(() => setBusy(false))
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```
Note on mark returned / discard: these are quick desk actions on an item card, not irreversible data loss (status only, item stays in the inventory), so no confirm step; the spec's in-page confirm applies to booking no-show/cancel.

- [ ] **Step 9: `web/src/operator/Bookings.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { opDayBookings, type DayBooking } from '../api'
import { href, navigate } from '../lib/router'
import BookingRow from './BookingRow'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'
import { isoDay } from './Today'

export default function Bookings({ params }: { params: URLSearchParams }) {
  const t = useOpT()
  const guard = useGuard()
  const date = params.get('date') ?? isoDay(new Date())
  const [list, setList] = useState<DayBooking[] | null>(null)
  useEffect(() => {
    setList(null)
    opDayBookings(date).then(setList, guard)
  }, [date, guard])
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-wide m-0 text-4xl font-black">{t.bookings.title}</h1>
      <label className="flex items-center gap-3 font-semibold">
        {t.bookings.date}
        <input type="date" value={date} onChange={(e) => navigate(href('operator/bookings', { date: e.target.value }))} className="min-h-11 border-2 border-ink bg-card px-3" />
      </label>
      {list && list.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.bookings.empty}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list?.map((b) => <BookingRow key={b.id} b={b} onChange={(nb) => setList((l) => l?.map((x) => (x.id === nb.id ? nb : x)) ?? null)} />)}
      </ul>
    </div>
  )
}
```
(The spec mentions showing empty slots too; with the public `getSlots` limited to tomorrow+ it cannot show today's. Listing the day's bookings is enough for the desk — keep it.)

- [ ] **Step 10: `App.tsx`** — the operator area renders without the public header/footer. At the top of `Shell`, after `const route = useRoute()` and before other hooks would change order — hooks must not be conditional, so instead make `App` choose:

```tsx
export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  )
}

function Root() {
  const route = useRoute()
  if (route.name === 'operator') return <OperatorApp page={route.page} params={route.params} />
  return <Shell />
}
```
and keep `Shell` as is (it calls `useRoute()` itself). Import `OperatorApp from './operator/OperatorApp'`.

- [ ] **Step 11: Verify** — `cd web && npm run build && npm run lint` → pass. Manual run (servers as in Task 6 Step 15): `#/operator` → redirected to login → `demo` / `demo-pass-123` → Today shows counts → Log item: pick a JPEG → "Reading the photo…" → fields → Save → toast "Logged as office-N" → Inventory shows it → Edit drawer saves → Bookings date picker works. Phone width (375 px) has no horizontal scroll on any operator page.

- [ ] **Step 12: Commit**

```bash
git add web/src
git commit -m "feat(web): operator back-office — login, today, intake with AI pre-fill, inventory, bookings"
```

---

### Task 8: End-to-end story, final docs and full verification

**Files:**
- Create: `web/e2e/operator.spec.ts`, `web/e2e/fixtures/wallet.jpg` (generate below)
- Modify: `web/playwright.config.ts` (comment only), `docs/STATUS.md` (handoff line)

**Interfaces:**
- Consumes: everything above; operator `demo` created by `python -m app.operators seed-demo --password <pw>`.

- [ ] **Step 1: Fixture photo** — generate a small JPEG:

```bash
cd server && .venv/Scripts/python.exe -c "from PIL import Image; Image.new('RGB',(800,600),(20,20,20)).save('../web/e2e/fixtures/wallet.jpg','JPEG')"
```

- [ ] **Step 2: Write `web/e2e/operator.spec.ts`**

```ts
import { expect, test } from '@playwright/test'
import path from 'node:path'

// Needs the backend on :8000 with an operator created by:
//   cd server && .venv/Scripts/python.exe -m app.operators seed-demo --password "$OPERATOR_PASSWORD"
const USER = process.env.OPERATOR_USER ?? 'demo'
const PASSWORD = process.env.OPERATOR_PASSWORD ?? 'demo-pass-123'
const PHOTO = path.join(import.meta.dirname, 'fixtures', 'wallet.jpg')

test('operator logs an item, citizen books it, desk marks it collected', async ({ page, context }, info) => {
  const tag = `E2E-${info.project.name}-${Date.now()}` // unique text to find this run's item

  // AI pre-fill is mocked: the real draft is stored, only the suggestions are replaced.
  await page.route('**/api/operator/items/draft', async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    await route.fulfill({ response: res, json: { ...body, suggested: { category: 'wallet', brand: null, colour: 'black', descr: `Portafoglio nero ${tag}` } } })
  })

  // 1. operator logs in and logs the item
  await page.goto('/#/operator')
  await expect(page).toHaveURL(/#\/operator\/login/)
  await page.getByLabel(/username|utente/i).fill(USER)
  await page.getByLabel(/password/i).fill(PASSWORD)
  await page.getByRole('button', { name: /log in|entra/i }).click()
  await page.goto('/#/operator/new')
  await page.getByTestId('photo-input').setInputFiles(PHOTO)
  await expect(page.getByLabel(/description|descrizione/i)).toHaveValue(`Portafoglio nero ${tag}`)
  await page.getByLabel(/where found|dove/i).fill('Stazione Termini')
  await page.getByRole('button', { name: /^(save|salva)$/i }).click()
  const toast = await page.getByTestId('toast').textContent()
  const officeId = toast!.match(/office-\d+/)![0]

  // 2. citizen (fresh context, no operator cookie) finds it and books
  const citizen = await context.browser()!.newContext()
  const c = await citizen.newPage()
  await c.goto(`/#/catalogue?source=office&q=${encodeURIComponent(tag)}`)
  await c.getByTestId('office-card').first().click()
  await expect(c).toHaveURL(new RegExp(`#/item/${officeId}`))
  await c.getByTestId('book-cta').click()
  const panel = c.getByTestId('booking-panel')
  // pick the first chip whose day has a free slot, asking the API (the server is authoritative)
  let picked = false
  for (const chip of await panel.locator('[data-day]').all()) {
    const day = await chip.getAttribute('data-day')
    const { slots } = await (await c.request.get(`/api/office/slots?date=${day}`)).json()
    if (slots.some((s: { free: boolean }) => s.free)) {
      await chip.click()
      picked = true
      break
    }
  }
  expect(picked, 'no free pickup slot in the next office days').toBeTruthy()
  await panel.getByTestId('slot').first().click()
  await panel.getByLabel(/name|nome/i).fill('Ana Rossi')
  await panel.getByLabel(/email/i).fill(`${tag}@example.com`)
  await panel.getByRole('checkbox').check()
  await panel.getByRole('button', { name: /confirm|conferma/i }).click()
  await expect(c.getByTestId('booking-code')).toHaveText(/^RT-[A-Z2-9]{4}$/)
  const manage = await c.getByRole('textbox').inputValue()
  const slotDay = (await c.request.get(`/api/bookings/${manage.split('booking/')[1]}`).then((r) => r.json())).slot_start.slice(0, 10)

  // 3. desk sees the booking that day and marks it collected
  await page.goto(`/#/operator/bookings?date=${slotDay}`)
  const row = page.getByTestId('booking-row').filter({ hasText: `${tag}@example.com` })
  await row.getByRole('button', { name: /^(collected|ritirato)$/i }).click()
  await expect(row).toContainText(/collected|ritirato/i)

  // 4. item is gone from the public side; manage page says collected
  expect((await c.request.get(`/api/items/${officeId}`)).status()).toBe(404)
  await c.goto(manage)
  await expect(c.getByTestId('booking-status')).toHaveText(/collected|ritirato|recogido|retiré|abgeholt/i)
  await citizen.close()
})
```
If a locator does not match the real markup, adjust the locator (not the product) and note it in the commit message.

- [ ] **Step 3: Run the full suite**

```bash
cd server && .venv/Scripts/python.exe -m pytest -q
cd server && .venv/Scripts/python.exe -m app.operators seed-demo --password demo-pass-123
cd server && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000   # separate terminal / background
cd web && npm run build && npm run lint && npx playwright test
```
Expected: pytest all green; Playwright: `operator.spec.ts` passes on desktop and phone; `app.spec.ts` and `media.spec.ts` pass as many as before this branch (record before/after counts in the commit message).

- [ ] **Step 4: `playwright.config.ts`** — extend the top comment with the seed-demo line.

- [ ] **Step 5: Commit**

```bash
git add web/e2e web/playwright.config.ts
git commit -m "test(e2e): operator intake → citizen booking → desk collection"
```

---

## Self-review notes (done while writing)

- Spec coverage: §1 tables/status rules/slots/photos → Tasks 2–4; §2 public + operator endpoints, AI pre-fill, CLI, deps → Tasks 2–5; §3 operator UI → Task 7; §4 strip, item page, booking, manage page, abuse limits, colour/place, matching → Tasks 4–6; §5 race safety, tokens, tests, e2e → Tasks 2–4, 8; §6 rollout order → task order; docs → Task 1.
- Known simplifications vs spec: operator Bookings page lists bookings, not empty slots (noted in Task 7 Step 9); day chips in the booking panel are Mon–Fri hints, the server is authoritative.
- Type names consistent: `OperatorItem`, `DayBooking`, `Draft`, `ItemFields`, `officeNumber`, `useGuard`, `useOpT`, `isoDay` defined once and reused.
