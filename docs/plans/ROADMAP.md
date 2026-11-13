# Plan

Each block's detailed task is written to `docs/plans/blocks/NN-*.md` from `_TEMPLATE.md`
right before the block starts.

| # | Block | Branch | Executor | Depends on |
|---|---|---|---|---|
| 00 | Skeleton: `server/` and `web/` layout, contract, catalogue API, Compose | main | orchestrator | — |
| 01 | First deploy over HTTPS | main | qa-deploy | 00 |
| 02 | Text search: `interpret` (LLM → filters), relaxing empty results, keyword fallback | feat/back | back-builder | 00 |
| 03 | UI: search screen, results, entry card with pickup info, catalogue filters, 5 languages | feat/front | front-builder | 00 |
| 04 | Voice: ElevenLabs speech-to-text endpoint | feat/back | back-builder | 02 |
| 05 | Photo: vision description endpoint | feat/back | back-builder | 02 |
| 06 | Daily update: check the source PDF, read new pages, insert new entries | feat/back | back-builder | 00 |
| 07 | UI: mic recording, photo upload, "last checked" footer, polish | feat/front | front-builder | 03 |
| 08 | Integration: full demo script in production | main | orchestrator + qa-deploy | 04, 05, 07 |
| 09 | Pitch, video, submission | — | judge-pitch + owner | 08 |

In parallel: 02 ∥ 03, then (04 → 05 → 06) ∥ 07.
Critical path: 00 → 01 → 02 → 04 → 08 → 09.

## Acceptance in one line per block

- 00 — `pytest` in `server/` and `npm run build` in `web/` are green; `/api/items?q=iphone` returns entries.
- 01 — `curl https://<subdomain>/api/health` returns `{"ok": true}`.
- 02 — "I lost my black Samsung phone in October" → `category: phone`, `brand: SAMSUNG`,
  an October date range, `ignored` contains colour; with no API key the endpoint still answers.
- 03 — the 20–60 s step of the demo script works in a browser against the real API, in all five languages.
- 04 — a recorded Spanish phrase returns its transcript and matching entries.
- 05 — a photo of keys returns `category: keys` and entries.
- 06 — re-reading a page already in the database yields the same registry numbers and
  dates as the stored rows; an unchanged PDF only updates `last_checked_at`.
- 07 — the 60–135 s steps of the demo script work on a laptop and on a phone.
- 08 — `qa-deploy` runs the whole script in production without a manual fix.

## Research needed before the blocks (for `researcher`)

Listed in `docs/RESEARCH.md` → "Open questions".
