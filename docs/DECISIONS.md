# Decision log

Format: id, date, decision, why, when to revisit.

## D-001 · 2026-10-30 · Six agents, two writing branches

Orchestrator (main chat), `researcher`, `back-builder`, `front-builder`, `qa-deploy`,
`judge-pitch`. Only builders write code, each in its own folder (`server/`, `web/`) and
worktree, so conflicts are rare. Code goes to Codex and reading to DeepSeek: separate
pools that don't spend the Claude 5-hour window.

## D-002 · 2026-11-13 · Stack: FastAPI + Vite/React/Tailwind, one container

`server/` is Python 3.12 + FastAPI (the data is SQLite and the parser is already Python).
`web/` is Vite + React + TypeScript + Tailwind: the owner's criterion is that the site
looks good, and a component stack gets there faster than hand-written HTML. The Docker
image builds `web/` and FastAPI serves it, so there is still one service to deploy.

## D-003 · 2026-10-30 · Deploy to our own server

Docker Compose on `rilya-server` instead of Vercel etc.: there is capacity and the
process is proven on other projects. Details: `docs/OPERATIONS.md`.

## D-004 · 2026-10-30 · Web, not iOS

Judges open a link; they won't install TestFlight. The rules require a live link.

## D-005 · 2026-10-30 · All project files in English

The team may include other participants. Docs, code and commits are in English;
product UI in Italian and English.

## D-006 · 2026-11-13 · Idea: official challenge 3, "Oggetti smarriti"

Search over the city's found-items registry by catalogue filters, free text, voice and
photo. The skeleton lives in this repo; the team repo `Honi05/Lost-items` holds the data
originals. Voice is a microphone button (speech-to-text), not a conversational agent:
one pipeline for all inputs and less to break on stage.

## D-007 · 2026-11-13 · One pipeline; the LLM only builds filters

Text, voice and photo all end in the same `interpret` step that produces catalogue
filters; results come only from SQL. The model cannot invent an entry, and when it is
unavailable the search degrades to keywords instead of failing.

## D-008 · 2026-11-13 · Daily update reads new pages with a vision model

The snapshot was OCR'd with macOS Vision, which does not exist on the Linux server. The
list grows by a few pages a day, so the update sends only the new pages to the vision
model and asks for records (number, date, description) directly. No OCR engine in the
image, and no positional parser to re-tune for a different OCR. Revisit (Tesseract with
`parse.py`) if block 06 finds the model misreads registry numbers on a known page.

## D-011 · 2026-11-13 · Document numbers never reach the browser

The registry prints partial document, card and IMEI numbers (already masked by the
police). The challenge requires no exposure of personal data, so the API strips them
from descriptions and search ignores them. Using them server-side to confirm ownership
("does your ID start with CA9…?") is a possible later feature, not MVP.

## D-009 · 2026-11-13 · Seed database in Git, live database in a volume

`server/seed/oggetti.sqlite` (3 MB) ships in the image; the app copies it to the `data`
volume on first start and the daily update writes there. Deploys cannot overwrite fresh
data, and a fresh clone runs without extra steps.

## D-010 · 2026-11-13 · Interface in IT, EN, ES, FR, DE

Owner's choice: the main languages of visitors to Rome. Queries are understood in any
language regardless; this is about interface strings.

## D-012 · 2026-11-13 · Runtime LLM is DeepSeek only

Owner's call: one provider, DeepSeek, for the product. `interpret` uses `deepseek-chat`
with JSON output via the OpenAI-compatible API (`https://api.deepseek.com`). DeepSeek has
no vision, so: D-008 is replaced by Tesseract + `parse.py` for new PDF pages, and the
photo query (block 05) is open until the owner picks a non-server option or cuts it.
Development code is also written by DeepSeek through `scripts/ds_code.py`.
