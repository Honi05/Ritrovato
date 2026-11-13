# Next steps for the frontend (13 Nov, night)

Block 03 is merged into `main` and live at https://ritrovato.quietunit.com. Great work.
The whole backend is live too, including voice and photo search.

## 1. Sync your branch (2 min)

```bash
git checkout feat/front
git pull origin main
git rebase main          # or: git merge main — whichever you prefer
```

No conflicts expected: `main` changed only `server/` and `docs/` since your branch.

## 2. Fix one e2e test (5 min)

`web/e2e/app.spec.ts:35` expects exactly `15,560` entries on the home page. Production
now has 15,732, because the daily registry update added new entries, and the number
will keep growing. Assert that a count is shown, not its value — for example, read
`total` from `GET /api/meta` in the test and expect that number formatted.

Everything else passed against production: 28 of 30 tests, desktop and phone.

To run the suite against production instead of a local backend, use a throwaway config
(do not commit it):

```ts
// web/pw.prod.tmp.config.ts
import base from './playwright.config'
export default { ...base, webServer: undefined,
  use: { ...base.use, baseURL: 'https://ritrovato.quietunit.com' } }
```

```bash
npx playwright test -c pw.prod.tmp.config.ts
```

## 3. Your next block: 07 — voice and photo in the UI

Task file: `docs/plans/blocks/07-ui-voice-photo.md`. If you use Claude, tell it
"do block 07". Summary:

- Mic button: record with `MediaRecorder`, send to `searchVoice` (already in `web/src/api.ts`).
- Photo button: pick or take a photo, downscale to ≤1600 px JPEG, send to `searchPhoto`.
- On the results screen, show what the server heard (`transcript`) or saw (`description`).
- On 429 / 502: keep the user's input, show the error message, focus the text box.
- Footer: "registry last checked" from `GET /api/meta` → `last_checked_at`.

**Cost and limits.** Every real voice or photo call costs money, and the server allows
only 20 such calls per 10 minutes per IP (500 per day overall). In tests, mock voice and
photo with `page.route`; make at most one or two real calls by hand.

## 3b. Then block 07b — "narrow it down" chips

Task file: `docs/plans/blocks/07b-refine-chips.md`. "Lost my wallet" today returns ~4800
wallets; chips like "Intesa card" or "Driving licence" cut that to a handful. Free (no AI
call), uses the existing `GET /api/items`. 90 minutes.

## 4. Handing work over

Commit on `feat/front`, push the branch, and message the owner. The owner merges into
`main` and deploys; you never need server access.

Feature freeze: **Saturday 08:00**. Submission: **Saturday 14:00**.
