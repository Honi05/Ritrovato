# Frontend — instructions for the teammate

You own `web/`. The owner and the orchestrator chat own `server/`, the API contract and
`main`. Submission is **Saturday 14:00**; feature freeze **Saturday 08:00**.

**What to do now: `docs/NEXT-FRONT.md`.**

## 1. Setup (10 min)

```bash
git clone <team repo> && cd <repo>
git checkout -b feat/front main

# backend on :8000 (serves the seed catalogue)
cd server && uv venv && uv pip install -r requirements.txt pytest httpx
.venv/bin/uvicorn app.main:app --reload

# frontend on :5173, proxies /api to :8000
cd web && npm i && npm run dev
```

All endpoints are live, including voice and photo: `https://ritrovato.quietunit.com/api/...`.

## 2. Read, in this order

1. `CLAUDE.md` — team rules (if you use an AI agent, it reads this automatically).
2. `docs/PRODUCT.md` — the **demo script** and honesty rules. The script beats any feature.
3. `docs/ARCHITECTURE.md` → "API contract" — the only interface between us.
4. `docs/plans/blocks/03-ui-search.md` — your first block.

## 3. Your blocks

| Block | What | When |
|---|---|---|
| 03 | Search screen, chips "what we understood", results, entry card with pickup info, catalogue filters, IT/EN/ES/FR/DE, mobile layout | now → ~23:00 |
| 07 | Mic recording → `POST /api/search/voice`; photo upload; "last checked" footer; polish | after 03 → Sat 06:00 |

Details and acceptance checks are in each block file: `docs/plans/blocks/07-ui-voice-photo.md`.

Photo search is decided (D-013): the server describes the photo, the frontend only uploads it
to `POST /api/search/photo`. No in-browser model.

## 4. Rules

- Touch only `web/`. Never edit `server/`, `docs/STATUS.md` or the contract.
- Need a contract change (new field, different shape)? Ask the owner; the orchestrator
  changes it in `main`, then you `git rebase main`.
- UI text in IT, EN, ES, FR, DE via `web/src/i18n/`; code, identifiers, commits in English.
- Honesty: show attributes the registry cannot match (`ignored`: colour, place) as
  "not recorded"; show descriptions in the original Italian; never invent data.
- Never show document, card or IMEI numbers (the API already strips them).
- No secrets in the frontend — all keys live on the server.
- Voice/photo can answer 429 `rate_limited` (20 per 10 min per client) or 502
  `upstream_failed`: keep the user's input, show the API `message`, focus the text box.
  The live API is at `https://ritrovato.quietunit.com/api/...`.

## 5. Handing work over

Small, frequent merges — every 1–2 hours, not one big one at the end.

1. `cd web && npm run build` must be green.
2. Check the demo step in the browser against the local backend.
3. One commit per block on `feat/front`, push the branch, tell the owner:
   `DONE Block 03 — <what works>. Commit: <hash>. Checks: npm run build green.`
4. The orchestrator merges to `main` and deploys. Stuck? `BLOCKED Block 03 — needed: <one thing>.`

Before each new block: `git fetch && git rebase origin/main`.
