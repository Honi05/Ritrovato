# Next steps for the frontend (13 Nov, evening)

Block 07 is live at https://ritrovato.quietunit.com. Voice and photo work end to end in
production: "ho perso il mio telefono samsung" → phone, SAMSUNG, 263 results; a photo of
a key → "Chiave", keys. 56 of 58 e2e tests pass against production. Great work.

Three things left, in this order.

## 0. Sync first (1 min)

```bash
git checkout feat/front && git pull origin main
```

`main` gained one server commit (search vocabulary) and this file.

## 1. Fix the stale count in e2e (5 min)

`web/e2e/app.spec.ts:35` expects exactly `15,560` entries. Production has more, and the
number grows after every daily registry update, so both desktop and phone fail. Read the
real number instead:

```ts
const { total } = await (await page.request.get('/api/meta')).json()
await expect(page.getByText(total.toLocaleString('en-US'), { exact: true }).first()).toBeVisible()
```

To run the suite against production, use a throwaway config (do not commit it):

```ts
// web/pw.prod.tmp.config.ts
import base from './playwright.config'
export default { ...base, webServer: undefined,
  use: { ...base.use, baseURL: 'https://ritrovato.quietunit.com' } }
```

```bash
npx playwright test -c pw.prod.tmp.config.ts   # expect 58/58
```

## 2. Finish block 07: the 429 case (15 min)

Block 07 acceptance asks for this; it is the only missing piece.

The server answers voice/photo with `429 {"error":"rate_limited", ...}` after 20 calls per
10 minutes per client. On stage the whole room shares one IP, so this can happen during
the demo. Today `fail()` in `web/src/components/SearchBar.tsx:43-49` shows the generic
"failed" text for it.

Do:

- In `fail()`: `e instanceof ApiError && e.status === 429` → a new string `m.rateLimited`,
  for example "Too many voice/photo searches right now — type what you lost instead.",
  in all 5 languages.
- For 429 and 502, also put the cursor in the text box, keeping whatever the user had
  typed. The text `<input>` (line ~145) has no ref yet: add `const textRef =
  useRef<HTMLInputElement>(null)`, `ref={textRef}`, and call `textRef.current?.focus()`.
- New e2e in `web/e2e/media.spec.ts`: `page.route('**/api/search/photo', r => r.fulfill({
  status: 429, contentType: 'application/json', body: JSON.stringify({ error:
  'rate_limited', message: 'too many' }) }))` → upload → the message is visible, the text
  box is focused, and a typed text search still returns results. Same for voice.

## 3. Block 07b — "narrow it down" chips (90 min)

Task file: `docs/plans/blocks/07b-refine-chips.md`. "Lost my wallet" returns ~4800
wallets; chips like "Intesa card" or "Driving licence" cut that to a handful. Free (no AI
call), uses the existing `GET /api/items`. Every chip word is already checked against the
data.

## Handing work over

Push `feat/front` and message the owner — please do not merge into `main` yourself; the
owner merges, runs the checks and deploys. One commit per item above is ideal.

**Cost and limits.** Every real voice or photo call costs money and counts toward the
20 per 10 min limit. Mock them with `page.route` in tests.

Feature freeze: **Saturday 08:00**. Submission: **Saturday 14:00**.
