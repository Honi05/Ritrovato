# Block 03 — UI: search, results, entry card, 5 languages

Depends on: 00. Executor: teammate (own session). Branch: feat/front. Folder: web/.

## Goal

The 20–60 s step of the demo script (`docs/PRODUCT.md`) works in a browser against the
real API, in IT, EN, ES, FR, DE.

## Context

- Contract: `docs/ARCHITECTURE.md` → "API contract" (`Item`, `Interpreted`,
  `SearchResponse`, `GET /api/items`, `GET /api/meta`, `POST /api/search/text`).
  Until block 02 lands in `main`, `/api/search/text` may return 501 — build against the
  contract types; `GET /api/items` already works on the seed DB.
- Honesty rules: `docs/PRODUCT.md` → "Honesty rules" (show `ignored` as
  "colour is not recorded"; descriptions in original Italian).
- Pickup info for the card: `docs/RESEARCH.md` → "Pickup rules for the entry card".

## Do

1. Search screen: one text box, submit → chips of what was understood (category, brand,
   dates, ignored attributes) → result list (registry number, date found, PDF page,
   link to source).
2. Entry card: fields above + pickup info with its source link.
3. Catalogue browse with filters (category, brand, date, keyword) via `GET /api/items`.
4. Language switch IT/EN/ES/FR/DE, strings in `web/src/i18n/`; mobile layout.
5. Remove unused Vite template files (`src/App.css`, `src/assets/`, `public/icons.svg`).

## Acceptance

- `cd web && npm run build` — green.
- Local run against `server/` (`npm run dev` proxies `/api` to :8000): demo query
  "I lost my black Samsung phone in October" shows chips + entries, in all five languages.

## Don't

Touch files outside `web/`, `docs/STATUS.md`, the API contract; `git push` without the
owner. Contract change needed → ask the orchestrator (owner relays).

## Timebox

2–3 hours. Mic and photo upload are block 07, not here.
