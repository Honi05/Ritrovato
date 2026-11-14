# <img src="docs/brand/logo-icon-512.png" alt="" width="52" align="middle"> Ritrovato

**Lost something in Rome? Describe it, say it or photograph it, in your language.**

Rome's found-items office publishes its registry only as scanned PDFs in Italian: about
500 pages a year, no text layer, no search. Ritrovato digitised the 2025–2026 registry
(~15.7k entries) and lets anyone find their item in seconds.

**Live:** https://ritrovato.quietunit.com

Built in 20 hours at Agentic Hack Rome, 13–14 Nov 2026, challenge 3 "Oggetti smarriti".

## What it does

- **Text**: "I lost my Samsung phone in October" in any of five languages
  (IT, EN, ES, FR, DE). An AI agent turns it into catalogue filters: category, brand, dates,
  keywords.
- **Voice**: tap the mic. ElevenLabs transcribes the speech, then the same agent runs.
- **Photo**: upload a picture of the lost thing or a similar one. An ElevenLabs agent
  describes it, then the same search runs.
- **Narrow it down**: chips such as "Driving licence" or "Intesa card" cut thousands of
  hits to a handful, with no extra AI call.
- **Entry card**: registry number, date found, PDF page, a link to the official source and
  how to collect the item.
- **Daily update**: the server checks the city's page for a new PDF, runs OCR on it and
  adds the new entries.
- **Found at the office**: items logged by office staff, with photo, colour and place,
  appear in every search next to the registry hits.
- **Pickup booking**: book a 15-minute slot to collect an office item and get a private
  link to view or cancel it. Ownership is checked at the desk, not online.

## For office staff

A back-office at `#/operator/login` (also linked as "Staff login" in the site header):

- **Today**: today's pickups, available items and bookings this week.
- **Log item**: take or upload a photo; the photo agent suggests category, brand, colour
  and description, staff check them and add where and when it was found.
- **Inventory**: search and edit logged items, mark them returned or discarded.
- **Bookings**: bookings by day; mark collected, no-show or cancelled.

Staff items live in a separate `office.sqlite`, so the registry is untouched
([D-015](docs/DECISIONS.md)).

## Honest by design

- The registry has no colour, no place found and no photo. When a query mentions them,
  the site says they are not recorded (only office-logged items carry them).
- If nothing matches, the site widens the search and shows which filters it dropped.
- Document numbers (IDs, IMEI) are stripped from public descriptions.

## How it works

```text
text ─────────────┐
voice ─ STT ──────┼─► interpreter agent ─► filters ─► SQLite registry ─► results
photo ─ vision ───┘   (ElevenLabs Agent → DeepSeek → keyword fallback)
                                                     ▲
city PDF ─► OCR (Tesseract) ─► parser ─► daily update┘
```

| Part | Tech |
|---|---|
| Backend | FastAPI, SQLite, PyMuPDF, Tesseract |
| Frontend | Vite, React, Tailwind, five UI languages, mobile first |
| AI | ElevenLabs Agents (query interpretation, photo), ElevenLabs STT, DeepSeek fallback |
| Deploy | one Docker container behind Cloudflare Tunnel |

API contract: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Data source and limits:
[docs/DATA.md](docs/DATA.md).

## Run locally

```bash
cp .env.example .env                          # add your keys; works without them via keyword fallback
cd server && uv venv && uv pip install -r requirements.txt pytest httpx
DB_PATH=/tmp/oggetti.sqlite UPDATE_DISABLED=1 .venv/bin/uvicorn app.main:app --reload
cd web && npm i && npm run dev                # Vite proxies /api to 127.0.0.1:8000
```

Staff accounts (run in `server/`):

```bash
python -m app.operators create-admin <username>         # prompts for the password
python -m app.operators seed-demo --password <pw>       # operator "demo" + sample office items
```

Demo item photos are openly licensed (CC0 / public domain); credits are in
`server/seed/demo_photos/`.

Tests: `cd server && .venv/bin/pytest -q`, then `cd web && npm run build && npm run test:e2e`.
The e2e suite runs against the real API on :8000 and needs the demo operator first:
`python -m app.operators seed-demo --password demo-pass-123`.

Or the whole app: `docker compose up --build`.

## How we built it

A small team of humans plus AI agents with fixed roles: orchestrator, builders, QA and a
"judge" reviewer. They shared one API contract and worked block by block. Rules:
[CLAUDE.md](CLAUDE.md). Plan and decisions: [docs/plans/ROADMAP.md](docs/plans/ROADMAP.md),
[docs/DECISIONS.md](docs/DECISIONS.md).

## Team

rilya888 (backend, data, deploy) · Honi Arora (frontend, design)

MIT License.
