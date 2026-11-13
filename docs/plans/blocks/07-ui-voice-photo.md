# Block 07 — Voice and photo search in the UI

Depends on: 03, 04, 05 (all done). Executor: front-builder/Sonnet. Branch: `feat/front`. Folder: `web/`.

## Goal

From the search bar a user can speak the query or upload a photo, and gets the same
results screen as text search; when voice/photo fail, text search still works.

## Context

- Contract: `docs/ARCHITECTURE.md` → `POST /api/search/voice`, `POST /api/search/photo`,
  errors (429 `rate_limited`, 502 `upstream_failed`, 413, 400).
- Client functions already exist: `searchVoice`, `searchPhoto` in `web/src/api.ts`.
- Live API: `https://ritrovato.quietunit.com/api/...`.

## Do

1. Mic button in `SearchBar`: record with `MediaRecorder` (tap to start, tap to stop,
   auto-stop at 30 s), send the blob with the current UI language to `searchVoice`.
   Show "listening" / "processing" states. No mic permission → hide nothing, show a hint.
2. Photo button: `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`.
   Downscale to ≤1600 px JPEG in a canvas before upload (server cap 8 MB). Send to `searchPhoto`.
3. Results: same screen as text search. Above the chips show what the server heard/saw:
   `transcript` (voice) or `description` (photo), in quotes, editable into the text box.
4. Errors 429 / 502 / 413 / 400: keep the user's input, show the API `message` translated
   by code (`rate_limited`, `upstream_failed`, ...), put focus in the text box.
5. Footer "registry last checked: <date>" from `GET /api/meta` `last_checked_at`
   (null → hide).
6. Strings in all 5 languages.

## Acceptance

- `npm run build` and the existing e2e suite — green.
- New e2e: photo upload of a test JPEG (keys) → results screen with `description` shown
  (one real call is fine; mock the rest with `page.route`).
- e2e with `page.route` returning 429 for voice and photo → message shown, text box focused,
  text search still works.
- Manual on a phone: record "ho perso il mio telefono samsung" → results.

## Don't

Touch files outside `web/`, `docs/STATUS.md`, the API contract; loop paid calls in tests
(each real voice/photo call costs money and counts toward the 20/10 min limit).

## Timebox

180 minutes. If you can't make it, stop and report `BLOCKED` with the reason.
