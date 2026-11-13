# Ritrovato — web

React 19 + Vite + Tailwind 4. Hash routes, UI in it/en/es/fr/de (`src/i18n`).
Run: start the API (`cd server && uvicorn app.main:app --port 8000`), then `npm ci && npm run dev` (proxies `/api` to :8000).
Check: `npm run build` (tsc + vite) and `npm run lint`.
Test: `npx playwright test` needs the API on :8000; voice and photo are stubbed with `page.route`.
Mic needs https or localhost; photos are re-encoded to JPEG in the browser when HEIC or over 2000 px.
