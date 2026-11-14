# Architecture

"API contract" is the only link between `server/` and `web/`, so only the orchestrator
changes it, in `main`. TypeScript mirror of the contract: `web/src/api.ts`.

## Components

| Part | Folder | Branch | What it does |
|---|---|---|---|
| Backend | `server/` | `feat/back` | FastAPI: catalogue API, query interpretation (LLM), voice (ElevenLabs), photo (vision), daily update, office back-office and pickup booking |
| Frontend | `web/` | `feat/front` | Vite + React + TypeScript + Tailwind: search screen, results, entry card, 5 languages |
| Deploy | `Dockerfile`, `docker-compose.yml` | `main` | One image: builds `web/`, serves it and the API from one container |

Stack decision: `docs/DECISIONS.md` D-002.

## Flow

One pipeline; text, voice and photo differ only in the first step.

```
text  ─────────────────────────────┐
voice ─ ElevenLabs speech-to-text ─┼─► interpret (LLM) ─► Interpreted ─► SQL over SQLite ─► items
photo ─ vision model description ──┘         │
                                             └─ LLM fails / no key ─► keyword fallback
catalogue filters ─────────────────────────────────────────────────► SQL over SQLite ─► items
```

`interpret` maps free text in any language to catalogue filters: one of the existing
categories, a brand, Italian keywords as the registry words them, a date range, and the
list of attributes the registry cannot match (colour, place). The LLM never produces
entries — entries come only from the database.

## Layout

```
server/app/main.py      routes (contract)
server/app/db.py        SQLite access: search(), meta()
server/app/interpret.py block 02: text → Interpreted
server/app/voice.py     block 04: audio → text
server/app/photo.py     block 05: image → text
server/app/update.py    block 06: daily check of the source PDF
server/app/office_db.py   office.sqlite: operators, sessions, office_items, bookings
server/app/auth.py        operator passwords and sessions
server/app/photos.py      office photo uploads (WebP, EXIF stripped)
server/app/office_hours.py pickup slots
server/app/office.py      office items, office search
server/app/booking.py     pickup bookings
server/app/operator_api.py /api/operator/*
server/app/office_api.py  /api/office/*, /api/bookings/*, /api/photos/*
server/app/operators.py   CLI: create-admin, seed-demo
server/ingest/parse.py  OCR dump → rows (written before the hackathon; block 06 adapts it)
server/seed/oggetti.sqlite  catalogue snapshot shipped in the image
server/tests/           pytest
web/src/api.ts          contract types and fetch helpers
web/src/i18n/           it, en, es, fr, de strings
web/src/operator/       back-office screens
```

## API contract

All responses are JSON. Errors: `{"error": "<code>", "message": "<text>"}` with codes
`bad_request` (400), `unauthorized` (401), `not_found` (404), `conflict` (409), `too_large` (413),
`rate_limited` (429), `not_implemented` (501), `upstream_failed` (502). Voice and photo are capped (20 per 10 min per client, 500 per day):
on 429 or 502 from them the UI keeps the user's input and offers the text search instead.
Text search is capped too (60 per 10 min per client, env `TEXT_PER_IP`); its
interpretation is cached per (lowercased text, lang).

`lang` is one of `it`, `en`, `es`, `fr`, `de` (default `it`).

### Types

```jsonc
// Item
{
  "id": "2026-6741-495",            // year-reperto-page
  "year": 2026,
  "reperto": 6741,                  // registry number
  "date": "2026-11-03",             // date found, ISO
  "descr": "TELEFONO CELLULARE SENZA SIM - APPLE IPHONE",  // original Italian, numbers removed (see Safety)
  "category": "phone",              // see docs/DATA.md for the 15 categories
  "tags": ["phone"],
  "brand": "APPLE",                 // or null
  "number_guessed": false,          // true: OCR missed the registry number, the parser guessed it
  "source": {"page": 495, "url": "https://www.comune.roma.it/..."},
  "origin": "registry",             // "registry" | "office"
  "colour": null,                   // office only, else null
  "found_place": null,              // office only, else null
  "photo_url": null,                // office only, else null
  "status": null                    // office only: "available" | "reserved"; else null
}
// Registry items have origin "registry" and colour, found_place, photo_url, status all null.
// Office item example (logged by staff):
{
  "id": "office-42",
  "origin": "office",
  "year": 2026, "reperto": null,    // reperto null for office items
  "date": "2026-11-14",             // found_at
  "descr": "Portafoglio in pelle nero con tessera ATAC",
  "category": "wallet", "tags": ["wallet"], "brand": null,  // tags = [category]
  "number_guessed": false,
  "source": null,                   // {page, url} for registry items, null for office items
  "colour": "black",
  "found_place": "Termini, binario 4",
  "photo_url": "/api/photos/3f2a....webp",
  "status": "available"
}

// Interpreted
{
  "category": "phone",              // or null
  "brand": "SAMSUNG",               // or null
  "keywords": ["TELEFONO"],         // Italian, as worded in the registry
  "date_from": "2026-10-01",        // or null
  "date_to": "2026-10-31",          // or null
  "colour": "black",                // fixed set (black, white, grey, silver, gold, red, orange, yellow,
                                    // green, blue, purple, pink, brown, beige, multicolour), or null
  "place": "Termini",               // raw text, or null
  "ignored": ["colour"],            // mentioned by the user but not recorded in the registry;
                                    // fixed keys only: colour, place, photo, other_unrecorded
  "relaxed": []                     // filters dropped because nothing matched;
                                    // fixed keys: keywords, brand, dates
}

// SearchResponse
{
  "items": [Item],
  "total": 24,                      // registry matches before limit
  "office": [Item],                 // <= 6 office matches; items and total stay registry-only
  "interpreted": Interpreted,       // null = keyword fallback or plain catalogue filter
  "transcript": "...",              // voice only: what was heard
  "description": "..."              // photo only: what the model saw, always in Italian
}
```

### `GET /api/health`
→ `{"ok": true}`

### `GET /api/meta`
→
```json
{
  "total": 15560,
  "last_item_date": "2026-11-04",
  "last_checked_at": "2026-11-14T06:00:00Z",
  "new_items_last_check": 37,
  "categories": [{"id": "wallet", "count": 4831}],
  "source_url": "https://www.comune.roma.it/..."
}
```
`last_checked_at` is `null` until the daily update has run once.

### `GET /api/items/{id}`

One `Item` by its id `<year>-<reperto>-<page>`, or `office-<n>` (404 unless the office item is
`available` or `reserved`); 404 `not_found` otherwise.

### `GET /api/items`
Plain catalogue browse, no LLM. Query: `q` (space-separated keywords, all must occur),
`category`, `brand`, `date_from`, `date_to` (ISO), `limit` (1–100, default 20), `offset`.
→ `SearchResponse` with `interpreted: null`. Sorted by date, newest first.
New query `source=office`: office items only, paged in `items`. Without it, `office` holds
up to 6 matching office items on `offset=0` and `[]` otherwise.

### `POST /api/search`
Request: `{"query": "I lost my black Samsung phone in October", "lang": "en"}` (query 1–500 chars).
→ `SearchResponse`, up to 20 items.

### `POST /api/search/voice`
`multipart/form-data`: `audio` (what `MediaRecorder` produces: webm or mp4, ≤ 10 MB), `lang`.
→ `SearchResponse` with `transcript`.

### `POST /api/search/photo`
`multipart/form-data`: `image` (jpeg, png or webp, ≤ 8 MB), `lang`.
→ `SearchResponse` with `description`.

### Office public endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/office/slots?date=YYYY-MM-DD` | -> `{"date", "slots": [{"start": "...T09:15", "free": true}]}`; 400 outside the 14-day window |
| POST | `/api/office/items/{id}/book` | `{name, contact, slot_start, ack: true}` -> `{code, manage_token, slot_start, item_id}`; 409 `slot_taken` / `item_taken`; 400 invalid slot; 429 |
| GET | `/api/bookings/{token}` | -> booking with item summary; 404 |
| DELETE | `/api/bookings/{token}` | Cancel if `booked`; 404 / 409 otherwise |
| GET | `/api/photos/{name}` | Office photo from `PHOTOS_DIR` (the drafts subfolder is not served) |

Slots are 15 minutes, capacity 1, Europe/Rome local time, format `YYYY-MM-DDTHH:MM`,
bookable from tomorrow to today + 14 days. Booking limits: 5 per hour per IP, at most 2
`booked` bookings per normalised contact. Citizen `name` and `contact` are returned only by
the manage endpoint (to the token holder) and by operator endpoints.

### Operator endpoints

All require the session cookie `rt_op` (HttpOnly, SameSite=Lax, Secure over HTTPS, 12 h
sliding); otherwise 401 `unauthorized`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/operator/login` | `{username, password}`; sets cookie `rt_op`; 401 generic on failure; 10 tries / 10 min per IP |
| POST | `/api/operator/logout` | Deletes the session |
| GET | `/api/operator/me` | `{username, display_name, is_admin}` |
| POST | `/api/operator/items/draft` | multipart `image` -> `{draft_id, photo_url, suggested: {category, brand, colour, descr} or null}` |
| POST | `/api/operator/items` | `{draft_id?, category, brand?, colour?, descr, found_place, found_at}` -> Item |
| PATCH | `/api/operator/items/{id}` | Any field, `status` (`returned` / `discarded`), or new `draft_id` to replace the photo |
| GET | `/api/operator/items?status=&category=&q=&limit=&offset=` | Paged, newest first, all statuses |
| GET | `/api/operator/bookings?date=` | That day's bookings with item summary, name, contact |
| PATCH | `/api/operator/bookings/{id}` | `{status: collected, no_show or cancelled}` |

Item status: `available | reserved | returned | discarded`. Booking status:
`booked | collected | no_show | cancelled`. A booking moves the item `available` ->
`reserved`; cancel and no-show set it back to `available`; `collected` sets `returned`;
discarding an item cancels its active booking; setting an item `returned` marks an active
booking `collected`.

Photos: jpeg, png or webp, <= 8 MB, re-encoded to WebP, longest side 1200 px, EXIF stripped.
Draft photos live in `PHOTOS_DIR/drafts/` and are deleted after 24 h. The draft endpoint
runs the photo agent (`photo.describe`) and `interpret`; any failure gives `suggested: null`.

## External services

| Step | Service | Key |
|---|---|---|
| Query interpretation | ElevenLabs text-only agent (D-014), fallback DeepSeek (`deepseek-chat`, JSON output, `LLM_MODEL`) | `ELEVENLABS_API_KEY`, `DEEPSEEK_API_KEY` |
| Photo description | ElevenLabs Agent `ritrovato-photo-probe` (gemini-3.5-flash-lite, text-only, file input) (D-013) | `ELEVENLABS_API_KEY`, `ELEVENLABS_PHOTO_AGENT_ID` |
| OCR of new PDF pages | Tesseract + `parse.py` (D-012) | — |
| Speech-to-text | ElevenLabs Scribe | `ELEVENLABS_API_KEY` |
| "Other places to ask" (nice to have) | Exa | `EXA_API_KEY` |

Recipes: `docs/RESEARCH.md`.

## Data

SQLite, one table `oggetti` — schema and limits in `docs/DATA.md`. Staff-logged items,
operators, sessions and bookings live in a separate `office.sqlite` (D-015).

- `server/seed/oggetti.sqlite` is in Git and in the image.
- At runtime the app uses `DB_PATH` (`/data/oggetti.sqlite` in a Docker volume). On first
  start it copies the seed there; the daily update writes only to the volume, so deploys
  never overwrite fresh data.
- `office.sqlite` (env `OFFICE_DB_PATH`, default next to `DB_PATH`) holds operators, sessions,
  office items and bookings; photos go to `PHOTOS_DIR` (default `<office db dir>/photos`).
- Search audio and photos are processed in memory and never stored; office photos uploaded
  by operators are stored as WebP without EXIF.

## Daily update

A background task in the same container, once every 24 h (and once at start-up):

1. Fetch the source page, find the current-year PDF link.
2. Unchanged since last time (same PDF file name as stored in table `meta`) → only write
   `last_checked_at`.
3. Changed → download, take the pages from the last known page onward, extract the
   entries, insert the ones not yet in `oggetti`, write `last_checked_at` and
   `new_items_last_check`.

A failed run leaves the database untouched and is logged; the site keeps working on the
data it has. Details and the choice of OCR: block 06, `docs/DECISIONS.md` D-007.

## Safety

- No personal data leaves the server: partial document, card and IMEI numbers
  (`Nr: CA916****`) are stripped from `descr` in every API response and are never sent
  to the browser. Keyword search does not match on them either. `docs/DATA.md` → Limits.
- User text, transcripts, photo content and OCR'd PDF text are data, never instructions.
- Keys live only in `.env` on the server; the browser talks only to `/api`.

## Demo mode

`UPDATE_DISABLED=1`: the daily update does not run at start-up (no surprise during the pitch).
The demo uses the real catalogue; no stand-in data is needed. If the LLM or ElevenLabs
are down, text search falls back to keywords and the backup video covers voice and photo.
