# Block 07 — UI: mic, photo upload, footer, polish

Depends on: 03, 04, 05. Executor: front-builder/Sonnet. Branch: `feat/front`. Folder: `web/`.

## Goal

Demo-script steps 60–135 s (Spanish voice query, photo of keys) and the 160–180 s footer
work in the UI on a laptop and on a phone.

## Context

- Contract: `docs/ARCHITECTURE.md` → `POST /api/search/voice`, `POST /api/search/photo`,
  `GET /api/meta`, Types (`SearchResponse`, `Error`).
- Demo script: `docs/PRODUCT.md` → table rows 60–95, 95–135, 160–180.
- Existing code: `web/src/api.ts` already has `searchVoice(blob, lang)` and
  `searchPhoto(file, lang)`; `components/SearchBar.tsx` has a placeholder comment for the
  buttons; `pages/Home.tsx:18` already formats `last_checked_at`.

## Do

1. **Mic button** in `SearchBar.tsx`: `MediaRecorder` (pick a supported mime type:
   `audio/webm` → `audio/mp4` for iOS Safari). Press to start, press again to stop
   (max 30 s auto-stop). Visible recording state. Send via `searchVoice` (field `audio`,
   `lang`; max 10 MB). Permission denied / no `MediaRecorder` → clear inline message,
   text search still works.
2. **Photo button** in `SearchBar.tsx`: `<input type="file" accept="image/*"
   capture="environment">`. Before upload, re-encode anything that is not jpeg/png/webp
   (iPhone HEIC) and any image over ~2000 px to JPEG via canvas. Send via `searchPhoto`
   (field `image`, `lang`; max 8 MB).
3. **Results for voice/photo**: they cannot travel in the URL hash. Keep the last
   `SearchResponse` in a small shared store (module state + sessionStorage) and route to
   e.g. `#/search?mode=voice|photo`. On that page show the `transcript` ("You said: …")
   or `description` ("We see: …") above `Understood`, then the result list. Reuse the
   existing result components.
4. **Loading & errors**: spinner text for "transcribing…" / "looking at the photo…".
   Empty transcript (`""`) or `description: null` → friendly "didn't catch that / couldn't
   recognise an object, try again or type". 413 → "file too large"; 400/502/network →
   generic retry message. Make `api.ts` tolerate non-JSON error bodies and FastAPI's
   `{"detail": ...}` shape.
5. **Footer** in `App.tsx`: call `getMeta()` once. If `last_checked_at` is set →
   "Updated daily — last check <date>, N new entries". If `null` → "Data as of
   <last_item_date> · <total> entries" (no "daily" claim).
6. **Small fixes from the block 03 review**:
   - `src/api.ts`: `description?: string | null`.
   - `Search.tsx`: empty `q` must not hang on "loading"; re-submitting the same query
     re-runs it.
   - `ItemPage.tsx`: no `"null/2026"` when `reperto` is null.
   - `Catalogue.tsx`: drop stale "load more" responses after filters change.
   - Replace the Vite template `web/README.md` with 5 lines: how to run and test.
7. **i18n**: all new strings in it/en/es/fr/de.
8. **e2e**: add Playwright tests that stub `/api/search/voice` and `/api/search/photo`
   with `page.route` (upload a small fixture image; for voice, stub `MediaRecorder` or
   call through a test hook) and assert transcript/description + results render, on
   desktop and Pixel 7 projects.

## Acceptance

- `cd web && npm run build` — green; `npx tsc -b --noEmit` — exit 0.
- `npx playwright test` with the backend on :8000 — all green, including new stubbed
  voice/photo tests.
- Manual with backend + keys (if available): on localhost in Chrome, record a Spanish
  wallet query → transcript + wallet results; upload a keys photo → description + key
  results. If keys are not available, say so in the report — don't fake it.
- Mobile layout at 390 px: mic and photo buttons visible and tappable (≥ 44 px), no
  horizontal scroll.

## Don't

Touch files outside `web/`, `docs/STATUS.md`, the API contract; `git push`. No new
heavy dependencies (no HEIC library — canvas only; if the browser can't decode HEIC,
show the "use JPEG" message).

## Timebox

150 minutes. If you can't make it, stop and report `BLOCKED` with the reason.

## Follow-up (from the parallel block 07 file on origin/main, not yet built)

- 429 `rate_limited` / 502 `upstream_failed`: show a message translated by error code
  (today: generic retry text).
- Transcript/description editable into the text box; keep input and focus the text box on error.
- Real-call e2e for photo against production (one call only; paid, 20/10 min cap).
