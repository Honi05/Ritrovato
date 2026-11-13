# Block 06 — Daily update of the registry

Depends on: 00. Executor: DeepSeek via `scripts/ds_code.py`, accepted by orchestrator.
Branch: feat/back. Folder: server/.

## Goal

Once a day the server checks the city page for a newer current-year PDF, OCRs only the
new pages with Tesseract, inserts the new entries, and records `last_checked_at` and
`new_items_last_check` so `GET /api/meta` shows them.

## Context

- Source page and link format: `docs/RESEARCH.md` → "Source page INF39645". Current
  file on the site: `Rinvenimenti_01012026_11112026.pdf`; the DB holds 04112026 (498 pages).
- Parser: `server/ingest/parse.py` (reads OCR lines `x y text`, x/y normalised 0–1,
  origin bottom-left as macOS Vision gives it: y grows upwards; dates in the right column
  x > 0.6, numbers x < 0.2, descriptions 0.2 ≤ x < 0.7). Reuse its per-page logic and
  `classify`; refactor it into importable functions if needed, keeping its CLI working.
- Schema and limits: `docs/DATA.md`. DB access: `server/app/db.py` (`meta()` already
  reads table `meta(key, value)` if it exists). D-011: never store/return document numbers
  beyond what the existing pipeline already strips.
- Decision D-012: Tesseract (`tesseract` CLI via subprocess, `--psm 6` or better, TSV
  output, lang `ita` if installed else `eng`) + PyMuPDF (`pymupdf` in requirements) to
  render pages at ~300 dpi. No poppler.

## Do

1. `server/app/update.py`:
   - `find_pdf_url(html) -> (url, end_date)` via regex `Rinvenimenti_0101(\d{4})_(\d{8})\.pdf`
     (current year only).
   - `ocr_page(pdf_path, page_no) -> list[(x, y, text)]`: Tesseract TSV words grouped into
     lines (by block/par/line), converted to the Vision convention: x = left/W,
     y = 1 - (top + height)/H.
   - `run(force=False) -> dict`: fetch page (browser User-Agent, timeout 30 s); if the PDF
     name equals `meta.source_pdf` → only set `last_checked_at`, `new_items_last_check=0`.
     Else download to a temp dir, OCR pages from the last stored page of that year
     (re-read it, it may have grown) to the end, parse, `INSERT OR IGNORE` rows, update
     meta (`source_pdf`, `last_checked_at` ISO UTC, `new_items_last_check`). Any failure:
     keep the DB unchanged, still record `last_checked_at`, log the error, never crash.
   - CLI: `python -m app.update [--force] [--pages N]` (`--pages` caps OCR work for tests).
2. Schedule in `main.py` lifespan: a background thread that calls `run()` 60 s after start
   and then every 24 h; disabled when env `UPDATE_DISABLED=1`. Edit only the lifespan and
   imports of `main.py`.
3. Tests `server/tests/test_update.py`:
   - unit (no network, no tesseract): `find_pdf_url` on a fixture snippet; unchanged-PDF
     path only touches `last_checked_at`; coordinate conversion.
   - integration, `skipif` tesseract missing: OCR page 498 of
     `data/oggetti/Rinvenimenti_01012026_04112026.pdf` (path relative to repo root) and
     parse it → the set of (reperto, date) equals the stored rows for year 2026, page 498
     (≥ 90% overlap acceptable; print the diff).

## Acceptance

- `cd server && .venv/bin/python -m pytest -q` — green, including the integration test
  locally (tesseract installed).
- Live, orchestrator: `UPDATE_DISABLED=1 .venv/bin/python -m app.update` on a copy of the
  DB adds the entries 05/11–11/11/2026; `/api/meta` shows `last_checked_at` and the count.

## Don't

Touch files outside `server/` (the orchestrator updates the Dockerfile with
`tesseract-ocr tesseract-ocr-ita`); rewrite `main.py` wholesale; `git push`.

## Timebox

90 minutes.
