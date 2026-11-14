# Backend fixes after the audit (Sat 14 Nov, morning)

For the owner. Scope: `server/`, `scripts/`, docs. Audit run on `main` at `86d3a63`:
`pytest` 27 passed, 1 skipped; `tsc` clean. E2e, production and the Docker build were not
run by the audit.

We are past the 08:00 freeze, so everything here is a bug fix, not a feature. Do them in
this order; stop wherever time runs out. Submission is at 14:00.

Frontend counterpart: `docs/FIX-FRONT.md`. Items B2, B7 and B8 add fields the frontend
reads; the field names below are final, so both sides can work in parallel.

| # | Fix | Time | Needed for |
|---|---|---|---|
| B1 | Unblock the deploy (dirty seed database) | 5 min | any deploy |
| B2 | Report the filters that were really applied | 20 min | honesty rule, F1 |
| B3 | Close the document-number leak | 20 min | safety rule D-011 |
| B4 | Cache and rate-limit the text search | 15 min | cost, demo speed |
| B5 | Raise the voice/photo limit for the venue | 2 min | demo |
| B6 | Shorter upstream timeouts | 5 min | demo |
| B7 | `DEMO_MODE` in docs does not exist in code | 5 min | demo |
| B8 | Optional: one-item route, guessed-number flag | 25 min | F3, F4 |
| B9 | Housekeeping | 15 min | submission |

## B1. Unblock the deploy

`scripts/deploy.sh` refuses to run on a dirty tree, and the tree is dirty:

- `server/seed/oggetti.sqlite` is modified. Cause: without `DB_PATH` the app uses the seed
  file itself (`server/app/db.py:9`), and the daily updater, which starts 60 s after
  boot, created the `meta` table in it during a local run.
- `docs/DEMO-VIDEO.md` is untracked.

Do:

```bash
git checkout server/seed/oggetti.sqlite
git add docs/DEMO-VIDEO.md && git commit -m "docs: demo video script"   # or delete it
```

For local runs from now on, never point the app at the seed:

```bash
cd server && DB_PATH=/tmp/oggetti.sqlite UPDATE_DISABLED=1 .venv/bin/uvicorn app.main:app --reload
```

Check: `git status --porcelain` prints nothing.

## B2. Report the filters that were really applied

`search()` in `server/app/interpret.py:511-527` drops keywords, then the brand, then the
dates when nothing matches, but returns the original filters as `interpreted`. The UI
then shows chips "phone · SAMSUNG · October" above a list of any phones from any month.
This breaks the honesty rule in `docs/PRODUCT.md`.

Do:

- In `search()`, collect what was dropped: `relaxed: list[str]`, fixed keys only, in the
  order dropped: `"keywords"`, `"brand"`, `"dates"`. Dropping one keyword of several also
  counts as `"keywords"`.
- Return it inside `interpreted`: `{**shown, "relaxed": relaxed}`. When `interpreted` is
  `null` (keyword fallback), nothing changes.
- Contract: add `"relaxed": []` to the `Interpreted` type in `docs/ARCHITECTURE.md` with
  the comment "filters dropped because nothing matched; fixed keys: keywords, brand,
  dates". Mirror it in `web/src/api.ts` as `relaxed?: string[]` (the frontend treats a
  missing field as empty).

Check: a new test in `server/tests/test_interpret.py` — monkeypatch `interpret.interpret`
to return category `phone`, brand `SAMSUNG`, dates in the year 2031; the response has
`total > 0` and `interpreted["relaxed"] == ["dates"]`. A query that matches as is returns
`relaxed == []`.

## B3. Close the document-number leak

`public_descr` in `server/app/db.py:31-37` removes numbers only after a clean `Nr:` or
`IMEI:` label, or tokens with four digits in a row. OCR often garbles the label, so 68 of
15,560 cleaned descriptions still carry part of a document number, for example:

```
PATENTE DI GUDA - N: UIW622 - BANCOMAT ITA UNIPOL BANCA
PENTITA - N. CASADI CREPATENTE DI GUIDA EV: RMT952 - CARTA
```

Do, in `public_descr` only:

- Extend the label pattern to the garbled forms: `Nr`, `N`, `Nº`, `N°`, `NUM`, `EV`,
  `IMEI`, followed by `:` or `.`.
- Drop any token that mixes letters and digits and has three or more digits
  (`UIW622`, `RMT952`, `PA274+94`), and any token of three or more digits.
- Keep the existing `shortcut:` comment and update its text.

Check: a new test over the whole seed — after `public_descr`, no description matches
`\d{3}`. Today 68 do. Also assert that `TELEFONO CELLULARE SENZA SIM - APPLE IPHONE`
comes out unchanged. 19 descriptions are empty after cleaning; that is acceptable, do not
invent text for them.

## B4. Cache and rate-limit the text search

Since commit `37ec0a6` every `POST /api/search` calls the paid ElevenLabs agent, but
`paid_quota` (`server/app/main.py:89`) guards only voice and photo. A loop of requests
can burn the balance, and the same demo query is paid for again on every run.

Do:

- `functools.lru_cache(maxsize=512)` on a small wrapper around `interpret.interpret`,
  keyed by `(text.strip().lower(), lang)`. Do not cache `None` (a failed call must be
  retried): raise or skip the cache on `None`.
- A second, looser quota for `/api/search`: the same sliding window as `paid_quota` with
  its own counter, default 60 per 10 minutes per client, env `TEXT_PER_IP`. Reuse the
  existing function with a parameter; do not copy it.

Check: a test that calls `/api/search` twice with the same query and asserts the
monkeypatched upstream ran once. Live: the second run of a demo query answers in well
under a second.

## B5. Raise the voice/photo limit for the venue

The limit is 20 calls per 10 minutes per IP (`PAID_PER_IP`), and the whole venue shares
one IP. Judges trying the site during the pitch can lock the stage laptop out.

Do: in the server `.env` set `PAID_PER_IP=200` for the day; keep `PAID_PER_DAY=500`.
Note: `deploy.sh` copies `.env` with `cp -n`, so edit `$DEPLOY_DIR/app/.env` on the
server directly, then `docker compose up -d`.

## B6. Shorter upstream timeouts

Worst case for one text search today: 15 s for the signed URL, 8 s for the agent, 15 s
for DeepSeek — about 38 s before the keyword fallback (`server/app/interpret.py:15-17`).
The real latency was not measured by the audit; measure it once in production first.

Do: signed-URL request 3 s, `AGENT_TIMEOUT` 5 s, DeepSeek 6 s. Worst case becomes 14 s.

Check: `pytest` stays green; three demo queries in production each answer in under 5 s.

## B7. `DEMO_MODE` does not exist

`docs/ARCHITECTURE.md` ("Demo mode") and `docs/DEMO.md` tell the reader to set
`DEMO_MODE=1`. The code reads only `UPDATE_DISABLED` (`server/app/main.py:26`). Whoever
follows the docs gets a Tesseract run in the middle of the pitch.

Do: replace `DEMO_MODE` with `UPDATE_DISABLED=1` in both documents, and set it in the
server `.env` before the pitch. In the same pass fix two more stale lines in
`ARCHITECTURE.md`: the daily update detects a new file by its name, not by "size/hash";
and `description` is always Italian (the photo agent answers in Italian), not "in `lang`".

## B8. Optional: one-item route and guessed-number flag

Only if B1–B7 are done and deployed before 11:00.

- `GET /api/items/{id}` → `Item`, 404 `not_found` otherwise. `id` is
  `<year>-<reperto>-<page>`, the primary key of `oggetti`. Today an entry card opened in
  a new tab or from a shared link shows "not loaded" because no such route exists. Add
  the route and the error code to the contract.
- Add `"number_guessed": true|false` to `Item` from the `num_guessed` column (46 rows).
  For these rows OCR missed the registry number and the parser guessed it, but the UI
  tells the user to quote that number to the office. Note that `fix_sequence` in
  `server/app/update.py:153` also rewrites numbers without setting the flag — set it.

Check: tests for a known id, an unknown id, and one row with `num_guessed = 1`.

## B9. Housekeeping

- `server/requirements.txt` pins only `pymupdf`. Pin the rest to the versions in the
  running image (`docker compose exec app pip freeze`) so the final build cannot pull a
  different release.
- `scripts/deploy.sh` accepts a deploy when `/api/health` answers. Also require
  `/api/meta` to report `total > 0`.
- `docs/STATUS.md`: the judge #1 row sits inside the Blocks table instead of "Judge
  verdicts"; timeline boxes and the MVP checklist in `PRODUCT.md` are not ticked.
- `docs/DEMO.md` is still the empty template. Run `judge-pitch` to fill it.
- `data/` is in `.gitignore` but 32 MB under it are tracked; leave as is until after
  the submission.

## Before every deploy

```bash
cd server && UPDATE_DISABLED=1 .venv/bin/python -m pytest -q
cd ../web && npm run build
git status --porcelain            # must be empty
scripts/deploy.sh
```

Then run the demo script from `docs/PRODUCT.md` once in production by hand.
