# Operator back-office and pickup booking — design

Date: 2026-11-14 · Branch: `feat/operators` · Status: approved in brainstorming, awaiting spec review

## Goal

Ritrovato today only digitises the city's scanned registry: no photo, no colour, no place
found, and no way to act on a match. This adds a second data source — items logged by
staff at the office — and lets a citizen book a pickup slot for them.

Purpose: a portfolio-quality, fully working feature. No real users; GDPR-grade compliance
is out of scope, but it must be safe by default (auth, rate limits, no leaked secrets or
citizen contacts).

### Decisions taken

| Question | Decision |
|---|---|
| Who operates | One office (Ufficio Oggetti Rinvenuti), one shared inventory, one pickup address |
| Citizen action | Simple pickup booking; ownership is checked in person at the desk |
| Visibility | Everything an operator enters is public (photo, description, colour, place) |
| Search | Office items appear in the existing text / voice / photo / catalogue search |
| AI | Operator photo → suggested category, brand, colour, description; operator edits |
| Storage | New tables in the same SQLite file; photos on the `/data` volume (approach 1) |

### Success criteria

1. An operator logs an item from a photo in under a minute.
2. A citizen finds it via text, voice or photo search and books a slot.
3. The operator sees the booking for that day and marks it collected; the item leaves the
   public search.
4. All existing server tests and e2e tests still pass unchanged.

### Out of scope

Multiple organisations; claim review or chat; emails / SMS (no third-party calls);
private "identifying details" field; match alerts / notify-me; operator self-registration.

## 1. Data model

New tables, created by `db.init()` when missing. The registry table `oggetti` and the daily
update job are not touched.

```sql
operators (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- argon2id
  display_name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)
sessions (
  token_hash TEXT PRIMARY KEY,          -- sha256 of the cookie token
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  expires_at TEXT NOT NULL              -- 12 h, extended on use
)
office_items (
  id INTEGER PRIMARY KEY,               -- public id "office-<id>"
  category TEXT NOT NULL,               -- one of the 15 registry categories
  brand TEXT,                           -- upper case, like the registry
  colour TEXT,                          -- fixed set, see §4
  descr TEXT NOT NULL,                  -- 3–500 chars
  found_place TEXT NOT NULL,            -- 2–120 chars
  found_at TEXT NOT NULL,               -- ISO date, not in the future
  photo_path TEXT,                      -- "<uuid>.webp" under PHOTOS_DIR
  status TEXT NOT NULL,                 -- available | reserved | returned | discarded
  created_by INTEGER NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
bookings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES office_items(id),
  code TEXT UNIQUE NOT NULL,            -- "RT-XXXX", unambiguous alphabet
  manage_token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,                   -- 2–80 chars
  contact TEXT NOT NULL,                -- email or phone, 3–120 chars, normalised lower-case
  slot_start TEXT NOT NULL,             -- ISO local datetime, Europe/Rome
  status TEXT NOT NULL,                 -- booked | collected | no_show | cancelled
  created_at TEXT NOT NULL
)
CREATE UNIQUE INDEX one_booking_per_slot ON bookings(slot_start) WHERE status = 'booked';
CREATE UNIQUE INDEX one_booking_per_item ON bookings(item_id)    WHERE status = 'booked';
```

Categories: wallet, id_document, payment_card, bag, phone, other, keys, document_other,
electronics, clothing, glasses, sim, watch_jewelry, money, vehicle.

### Status rules

| Event | Booking | Item |
|---|---|---|
| Citizen books | → `booked` | `available` → `reserved` |
| Citizen or operator cancels | → `cancelled` | → `available` |
| Operator: no-show | → `no_show` | → `available` |
| Operator: collected | → `collected` | → `returned` |
| Operator discards item | any `booked` → `cancelled` | → `discarded` |

One active booking per item. A false claimant who books first is handled by the operator
cancelling the booking.

### Slots

- Office hours from `server/app/office_hours.py` (code constant, overridable by env
  `OFFICE_HOURS_JSON`). Default: Mon–Fri 08:30–13:00; Tue and Thu also 14:30–16:30.
  Address and hours reuse what the existing `Pickup` component shows.
- 15-minute slots, capacity 1. Bookable from tomorrow up to 14 days ahead.
- Times are Europe/Rome local.

### Photos

- Accepted: jpeg, png, webp, ≤ 8 MB. Re-encoded with Pillow to WebP, longest side 1200 px,
  EXIF stripped (removes GPS); corrupt images are rejected with 400.
- Stored as `PHOTOS_DIR/<uuid4>.webp` (default `/data/photos`, next to `DB_PATH`).
- Draft photos (uploaded for pre-fill, never saved) live in `PHOTOS_DIR/drafts/` and are
  deleted after 24 h by the existing background loop.

## 2. API

Contract changes go into `docs/ARCHITECTURE.md` and `web/src/api.ts` in the first commit.
Errors keep `{"error", "message"}`; new codes `unauthorized` (401) and `conflict` (409).

### Changed types

```jsonc
// Item — new fields, all existing fields keep their meaning
{
  "id": "office-42",                    // registry ids unchanged: "2026-6741-495"
  "origin": "office",                   // NEW: "registry" | "office"
  "year": 2026, "reperto": null,        // reperto null for office items
  "date": "2026-11-14",                 // found_at
  "descr": "Portafoglio in pelle nero con tessera ATAC",
  "category": "wallet", "tags": ["wallet"], "brand": null,  // tags = [category]
  "number_guessed": false,
  "source": null,                       // existing {page, url}; null for office items
  "colour": "black",                    // NEW, office only, else null
  "found_place": "Termini, binario 4",  // NEW, office only, else null
  "photo_url": "/photos/3f2a….webp",    // NEW, office only, else null
  "status": "available"                 // NEW, office only: available | reserved; else null
}
```

The new discriminator is named `origin` because `source` already holds the registry's
`{page, url}` object. `web/src` code that reads `item.source.page` must guard for null.

```jsonc
// Interpreted — two new optional fields
{ ..., "colour": "black", "place": "Termini" }   // both nullable

// SearchResponse — one new field
{ "items": [...], "total": 24, "interpreted": {...},
  "office": [Item] }                    // ≤ 6 office matches; items/total stay registry-only
```

### Public endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/items/{id}` | Accepts `office-<n>`; 404 for returned/discarded office items |
| GET | `/api/items` | New `source=office` filter returns office items only (paged in `items`) |
| GET | `/api/office/slots?date=YYYY-MM-DD` | → `{"date", "slots": [{"start": "…T09:15", "free": true}]}`; 400 outside the 14-day window |
| POST | `/api/office/items/{id}/book` | `{name, contact, slot_start, ack: true}` → `{code, manage_token, slot_start, item_id}`; 409 slot/item taken; 400 invalid slot; 429 |
| GET | `/api/bookings/{token}` | → booking with item summary; 404 |
| DELETE | `/api/bookings/{token}` | Cancel if `booked`; 404 / 409 otherwise |
| GET | `/photos/{file}` | Static mount of `PHOTOS_DIR` (drafts subfolder not served) |

Citizen `name` and `contact` are returned only by the manage endpoint (to the token
holder) and operator endpoints.

### Operator endpoints

All require the session cookie; otherwise 401 `unauthorized`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/operator/login` | `{username, password}`; sets cookie `rt_op` (HttpOnly, SameSite=Lax, Secure on HTTPS, 12 h); 401 generic on failure; 10 tries / 10 min per IP |
| POST | `/api/operator/logout` | Deletes the session |
| GET | `/api/operator/me` | `{username, display_name, is_admin}` |
| POST | `/api/operator/items/draft` | multipart `image` → `{draft_id, photo_url, suggested: {category, brand, colour, descr} \| null}` |
| POST | `/api/operator/items` | `{draft_id?, category, brand?, colour?, descr, found_place, found_at}` → Item |
| PATCH | `/api/operator/items/{id}` | Any field, `status` (`returned`/`discarded`), or new `draft_id` to replace the photo |
| GET | `/api/operator/items?status=&category=&q=&limit=&offset=` | Paged, newest first, includes all statuses |
| GET | `/api/operator/bookings?date=` | That day's bookings with item summary, name, contact |
| PATCH | `/api/operator/bookings/{id}` | `{status: collected \| no_show \| cancelled}` applying §1 rules |

### AI pre-fill

`draft` calls `photo.describe()` (existing ElevenLabs agent, 14 s timeout) to get an
Italian description, then runs it through `interpret` to get category, brand and colour.
`descr` is the description itself. Any failure → `suggested: null`; the draft photo is
still saved and the operator fills the form by hand. Rate limit: shared with the existing
photo limiter.

### CLI

`python -m app.operators create-admin <username>` (prompts for the password) and
`python -m app.operators seed-demo` (operator `demo`, ~8 office items with bundled
photos in `server/seed/office/`).

### Dependencies

`argon2-cffi`, `Pillow` added to `server/requirements.txt` (pinned).

## 3. Operator UI

Same React app, hash routes under `#/operator/...`, own minimal header ("Back-office",
operator name, log out), not linked from public navigation. Each page calls
`/api/operator/me` first; 401 → `#/operator/login`.

| Route | Content |
|---|---|
| `#/operator/login` | Username, password; generic error |
| `#/operator` | Today's bookings in time order (code, name, thumbnail, buttons Collected / No-show / Cancel); counts: available items, bookings this week; "+ Log found item" |
| `#/operator/new` | Phone-first intake: photo (`capture="environment"`) → "Reading the photo…" skeleton → form pre-filled, fields marked "suggested" until edited. Fields: category select, brand, colour select, description, place (datalist of recent places), date (default today). AI failure → empty form + note; saving is never blocked. Save → toast "Logged as office-42" → empty form |
| `#/operator/items` | Table (desktop) / cards (phone); filters status, category, keyword; row → edit drawer (fields, status, replace photo) |
| `#/operator/bookings` | Date picker; that day's slots, filled or empty, with the same status buttons |

Strings in `web/src/i18n/operator/{it,en}.ts`; other selected languages fall back to
English. Existing Tailwind tokens and components; no new UI library. No browser dialogs:
confirmations are in-page.

## 4. Citizen UI and search merge

### Results

- `SearchResponse.office` renders as a "Found at the office" strip above the registry
  results: photo, badge "Logged at the office", colour, place, date. Reserved items show
  "Pickup booked" without a button.
- Registry results keep their look plus a quiet "From the city PDF" badge.
- Home page: link "Recently logged at the office" → `#/catalogue?source=office`.

### Item page `#/item/office-42`

Large photo, description, category/brand, colour, place and date found, office address
and hours (`Pickup`), and **Book a pickup**:

1. Day chips for the next 14 office days; days with no free slot disabled.
2. Grid of free 15-minute slots.
3. Name, contact, checkbox "I understand I must describe the item and show ID at the desk".
4. Confirm → screen with code `RT-4K7Q`, date, time, address, what to bring, the manage
   link with a copy button, and "Add to calendar" (`.ics` generated in the browser).

409 handling: slot taken → reload slots, "That time was just taken — pick another";
item taken → "Someone booked this item a moment ago".

### Manage page `#/booking/<token>`

Status, item summary, slot, "Cancel booking" with in-page confirm. Unknown token →
"Booking not found".

### Abuse limits

Booking: 5 per hour per IP; at most 2 active bookings per normalised contact. The server
validates the slot (office hours, window, free); the browser is never trusted.

All five public languages get the new strings.

### Interpreting colour and place

- `Interpreted.colour` ∈ black, white, grey, silver, gold, red, orange, yellow, green,
  blue, purple, pink, brown, beige, multicolour, or null. `Interpreted.place`: raw text
  or null.
- The interpret prompt (ElevenLabs agent and DeepSeek fallback) is extended; missing or
  invalid values become null. The text cache keeps working (new fields are part of the
  cached value).
- `ignored` still lists colour/place for the registry; when `office` is non-empty the UI
  wording is "Not recorded in the city PDF — used for office items".
- Intake colour uses the same fixed set (select), so matching is exact.

### Matching office items

Applied to `/api/search`, `/api/search/voice`, `/api/search/photo` and `GET /api/items`:

- Only `available` and `reserved` items; reserved last.
- Hard filters: category, brand, date range, with the existing relaxation order (drop
  keywords → brand → dates) applied independently of the registry query.
- Keywords: `LIKE` against descr, brand, found_place; any keyword counts; score +1 each.
- Boosts: colour equal +2; any word of `place` (≥ 3 chars) in found_place +1.
- Order: score desc, then found_at desc. Limit 6.

## 5. Errors, safety, testing

- Booking is one SQLite transaction: check item `available` and slot valid → insert →
  set item `reserved`. The two partial unique indexes make a double booking impossible
  even under concurrent requests (`IntegrityError` → 409).
- Tokens (`secrets.token_urlsafe(32)`) are stored only as sha256 hashes. Password and
  token hashes never leave the server. Citizen contacts never appear in public endpoints
  or logs.
- Uploaded content and AI output are data, never instructions.

### Server tests (pytest, temp DB and temp `PHOTOS_DIR` per test)

- Auth: login ok / wrong password 401 / rate limit 429; every `/api/operator/*` route
  401 without cookie; logout invalidates the session.
- Office items: create, edit, status changes; photo re-encode strips EXIF; corrupt image 400.
- Draft: with `photo.describe` and `interpret` mocked → suggestions; mocked failure →
  `suggested: null`.
- Booking: happy path; slot outside hours / outside window 400; same slot twice 409; same
  item twice 409; cancel frees the item; collected → item returned and gone from public
  search; 2-active-bookings-per-contact limit; manage token view and cancel.
- Search merge: office item appears in `office`; `items`/`total` unchanged versus the
  same query without office items; colour boost ordering; `source=office` browse.

### E2E (Playwright)

One story, AI mocked via route interception: operator logs in → logs an item from a
fixture photo → citizen searches "black wallet Termini" → sees it in the office strip →
books a slot → gets a code → operator sees the booking for that day → marks collected →
item disappears from the public search. All existing e2e tests must pass.

## 6. Rollout

Small commits on `feat/operators`, in order:

1. Contract (`ARCHITECTURE.md`, `api.ts`), `DECISIONS.md` D-015, `PRODUCT.md` scope note
2. DB tables + auth + CLI
3. Office items + photos + AI draft
4. Slots + booking + manage endpoints
5. Search merge + interpret colour/place
6. Operator UI
7. Citizen UI (strip, item page, booking, manage page, i18n)
8. Seed demo data + e2e

Deploy is done by the teammate; a forwardable note is given after push. New env vars:
`PHOTOS_DIR` (optional), `OFFICE_HOURS_JSON` (optional). The `/data` volume already holds
the database, so photos persist across deploys.
