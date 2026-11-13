# Block 02 — Text search (LLM → filters)

Depends on: 00. Executor: DeepSeek via `scripts/ds_code.py`, accepted by orchestrator.
Branch: feat/back. Folder: server/.

## Goal

`POST /api/search/text` turns a free-form query in any language into catalogue filters
with DeepSeek and returns matching entries; without a key it still answers via keywords.

## Context

- Contract: `docs/ARCHITECTURE.md` → "API contract" (`Interpreted`, `SearchResponse`,
  `POST /api/search/text`) and the pipeline diagram.
- Recipe: `docs/RESEARCH.md` → "Text -> `Interpreted`". It was written for Claude; use
  DeepSeek instead (D-012): `POST https://api.deepseek.com/chat/completions`,
  model from env `LLM_MODEL` (default `deepseek-chat`), key from env `DEEPSEEK_API_KEY`,
  `response_format: {"type": "json_object"}`, the word "json" must appear in the prompt.
  Use `httpx` (add to `requirements.txt`), no vendor SDK. Timeout 15 s.
- Existing code: `server/app/main.py`, `server/app/db.py`, `server/tests/test_api.py`.

## Do

1. `server/app/interpret.py`: `interpret(text, lang) -> Interpreted`. Prompt lists the
   real categories from the DB (`db.meta()` or equivalent) and today's date. Validate the
   model output: unknown category → null, brand upper-cased, dates ISO; anything colour /
   place / photo-like goes to `ignored`.
2. Empty result → relax filters in order (keywords, then brand, then date) and say so in
   the response as the contract allows.
3. No key, HTTP error, timeout or bad JSON → keyword fallback over the raw text; never 5xx.
4. Wire the route in `main.py` per the contract.
5. Tests in `server/tests/test_interpret.py` with the HTTP call mocked (no network):
   the demo query, the fallback path, the relaxation path.

## Acceptance

- `cd server && .venv/bin/pytest -q` — green.
- With a real key: "I lost my black Samsung phone in October" → `category` = phone
  category, `brand: SAMSUNG`, October 2026 range, `ignored` contains the colour, items > 0.
- Without `DEEPSEEK_API_KEY`: same request returns 200 with items.

## Don't

Touch files outside `server/`, `docs/STATUS.md`, the API contract; `git push`.
Never put document / card / IMEI numbers in responses (D-011).

## Timebox

60 minutes.
