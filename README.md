# Ritrovato

Search Rome's found-items registry ("Oggetti smarriti") by text, voice or photo, in five
languages. Built for Agentic Hack Rome, 13–14 Nov 2026. Product: `docs/PRODUCT.md`.

## Structure

```text
.
├── CLAUDE.md              rules for AI agents (canonical); AGENTS.md points here
├── .claude/agents/        agent roles: researcher, back-builder, front-builder, qa-deploy, judge-pitch
├── docs/
│   ├── PRODUCT.md         idea, demo script, MVP scope
│   ├── STATUS.md          blocks, owners, handoff
│   ├── ARCHITECTURE.md    API contract server <-> web
│   ├── DATA.md            registry data, schema, limits
│   ├── DECISIONS.md       why things were decided
│   ├── OPERATIONS.md      server, deploy, secrets
│   ├── RESEARCH.md        Exa / ElevenLabs / Claude recipes
│   ├── DEMO.md            pitch, click script, backup video
│   ├── HACKATHON.md       event facts
│   └── plans/             ROADMAP.md and blocks/ (one file per block)
├── server/                FastAPI backend (Python)
│   ├── app/               API: main.py, db.py
│   ├── ingest/            PDF -> rows parser
│   ├── seed/              oggetti.sqlite, the catalogue shipped with the app
│   └── tests/             pytest
├── web/                   Vite + React + Tailwind frontend
│   └── src/               App.tsx, api.ts
├── data/                  raw sources: registry PDFs, OCR output, sqlite (not deployed)
├── scripts/               deploy.sh, worktrees.sh
├── Dockerfile, docker-compose.yml
└── .env.example           required secrets (real .env never committed)
```

## Run locally

```bash
cd server && uv venv && uv pip install -r requirements.txt pytest httpx
.venv/bin/uvicorn app.main:app --reload     # API on :8000
cd web && npm i && npm run dev              # proxies /api to :8000
```

Tests: `cd server && .venv/bin/pytest`. Frontend build: `cd web && npm run build`.
