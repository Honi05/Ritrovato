# Architecture

"API contract" is the only link between `server/` and `web/`, so only the orchestrator
changes it, in `main`. TypeScript mirror of the contract: `web/src/api.ts`.

## Components

| Part | Folder | Branch | What it does |
|---|---|---|---|
| Backend | `server/` | `feat/back` | FastAPI: catalogue API, query interpretation (LLM), voice (ElevenLabs), photo (vision), daily update |
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
server/ingest/parse.py  OCR dump → rows (written before the hackathon; block 06 adapts it)
server/seed/oggetti.sqlite  catalogue snapshot shipped in the image
server/tests/           pytest
web/src/api.ts          contract types and fetch helpers
web/src/i18n/           it, en, es, fr, de strings
```

## API contract

All responses are JSON. Errors: `{"error": "<code>", "message": "<text>"}` with codes
`bad_request` (400), `too_large` (413), `rate_limited` (429), `not_implemented` (501),
`upstream_failed` (502). Voice and photo are capped (20 per 10 min per client, 500 per day):
on 429 or 502 from them the UI keeps the user's input and offers the text search instead.

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
  "source": {"page": 495, "url": "https://www.comune.roma.it/..."}
}

// Interpreted
{
  "category": "phone",              // or null
  "brand": "SAMSUNG",               // or null
  "keywords": ["TELEFONO"],         // Italian, as worded in the registry
  "date_from": "2026-10-01",        // or null
  "date_to": "2026-10-31",          // or null
  "ignored": ["colour"]             // mentioned by the user but not recorded in the registry;
                                    // fixed keys only: colour, place, photo, other_unrecorded
}

// SearchResponse
{
  "items": [Item],
  "total": 24,                      // matches before limit
  "interpreted": Interpreted,       // null = keyword fallback or plain catalogue filter
  "transcript": "...",              // voice only: what was heard
  "description": "..."              // photo only: what the model saw, in `lang`
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

### `GET /api/items`
Plain catalogue browse, no LLM. Query: `q` (space-separated keywords, all must occur),
`category`, `brand`, `date_from`, `date_to` (ISO), `limit` (1–100, default 20), `offset`.
→ `SearchResponse` with `interpreted: null`. Sorted by date, newest first.

### `POST /api/search`
Request: `{"query": "I lost my black Samsung phone in October", "lang": "en"}` (query 1–500 chars).
→ `SearchResponse`, up to 20 items.

### `POST /api/search/voice`
`multipart/form-data`: `audio` (what `MediaRecorder` produces: webm or mp4, ≤ 10 MB), `lang`.
→ `SearchResponse` with `transcript`.

### `POST /api/search/photo`
`multipart/form-data`: `image` (jpeg, png or webp, ≤ 8 MB), `lang`.
→ `SearchResponse` with `description`.

## External services

| Step | Service | Key |
|---|---|---|
| Query interpretation | DeepSeek (`deepseek-chat`, JSON output, overridable via `LLM_MODEL`) | `DEEPSEEK_API_KEY` |
| Photo description | ElevenLabs Agent `ritrovato-photo-probe` (gemini-3.5-flash-lite, text-only, file input) (D-013) | `ELEVENLABS_API_KEY`, `ELEVENLABS_PHOTO_AGENT_ID` |
| OCR of new PDF pages | Tesseract + `parse.py` (D-012) | — |
| Speech-to-text | ElevenLabs Scribe | `ELEVENLABS_API_KEY` |
| "Other places to ask" (nice to have) | Exa | `EXA_API_KEY` |

Recipes: `docs/RESEARCH.md`.

## Data

SQLite, one table `oggetti` — schema and limits in `docs/DATA.md`.

- `server/seed/oggetti.sqlite` is in Git and in the image.
- At runtime the app uses `DB_PATH` (`/data/oggetti.sqlite` in a Docker volume). On first
  start it copies the seed there; the daily update writes only to the volume, so deploys
  never overwrite fresh data.
- Uploaded audio and photos are processed in memory and never stored.

## Daily update

A background task in the same container, once every 24 h (and once at start-up):

1. Fetch the source page, find the current-year PDF link.
2. Unchanged since last time (URL + size/hash stored in table `meta`) → only write
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

`DEMO_MODE=1`: the daily update does not run at start-up (no surprise during the pitch).
The demo uses the real catalogue; no stand-in data is needed. If the LLM or ElevenLabs
are down, text search falls back to keywords and the backup video covers voice and photo.
