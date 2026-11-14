# Ritrovato

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

## Honest by design

- The registry has no colour, no place found and no photo. When a query mentions them,
  the site says they are not recorded.
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
cd web && npm i && npm run dev                # proxies /api to :8000
```

Tests: `cd server && .venv/bin/pytest -q`, then `cd web && npm run build && npx playwright test`.

Or the whole app: `docker compose up --build`.

## How we built it

A small team of humans plus AI agents with fixed roles: orchestrator, builders, QA and a
"judge" reviewer. They shared one API contract and worked block by block. Rules:
[CLAUDE.md](CLAUDE.md). Plan and decisions: [docs/plans/ROADMAP.md](docs/plans/ROADMAP.md),
[docs/DECISIONS.md](docs/DECISIONS.md).

## Team

rilya888 (backend, data, deploy) · Honi Arora (frontend, design)

MIT License.
