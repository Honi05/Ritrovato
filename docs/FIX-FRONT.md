# Frontend fixes after the audit (Sat 14 Nov, morning)

Your last round (429 message, gallery picker, live entry count, "Narrow it down" chips)
is merged into `main` at `86d3a63`. Thank you — the audit found nothing wrong in it.

Four things are left. We are past the 08:00 freeze, so these are bug fixes only, no new
features. Submission is at 14:00; F1 and F2 matter most.

| # | Fix | Time | Depends on the backend |
|---|---|---|---|
| F1 | Say so when the search dropped a filter | 25 min | field `relaxed` (B2) |
| F2 | "Show more" loses the keywords | 5 min | no |
| F3 | Entry card opened from a link shows "not loaded" | 20 min | route B8, optional |
| F4 | Mark registry numbers that were guessed | 10 min | field B8, optional |

Backend counterpart: `docs/FIX-BACK.md`. The field names below are final, so you do not
have to wait for the backend: code against them and stub the responses in e2e.

## 0. Sync first

```bash
git checkout feat/front && git pull origin main
```

## F1. Say so when the search dropped a filter

When a search finds nothing, the server drops filters one by one (keywords, then brand,
then dates) until something matches. Today the page still shows the chips for the
original filters, so a user reads "phone · SAMSUNG · 01/10/2026 – 31/10/2026" above a
list of phones of any brand from any month. The site promises never to pretend.

The server will add one field to `interpreted`:

```ts
relaxed?: string[]   // filters dropped because nothing matched; only "keywords", "brand", "dates"
```

Do:

- Add the field to `Interpreted` in `web/src/api.ts`. Treat a missing field as `[]`.
- In `web/src/components/Understood.tsx`: draw the chip of a dropped filter struck
  through (brand chip for `"brand"`, date chip for `"dates"`), and under the chips show
  one line when `relaxed` is not empty, for example: "No exact match — showing results
  without: brand, dates." `"keywords"` has no chip; name it in the line as "details".
- New strings in all 5 languages: `search.relaxed` (the sentence) and
  `relaxedNames.keywords | brand | dates`.
- In `web/src/pages/Search.tsx`, the "show more" link must not send a dropped filter to
  the catalogue: skip `brand` when `relaxed` has `"brand"`, skip both dates when it has
  `"dates"`.

Check: a new e2e in `web/e2e/app.spec.ts` that stubs `**/api/search` with
`interpreted: { category: 'phone', brand: 'SAMSUNG', keywords: [], date_from: '2031-01-01',
date_to: '2031-01-31', ignored: [], relaxed: ['dates'] }` and expects the sentence to be
visible and the "show more" link to have no `date_from`. A second one without `relaxed`
expects no sentence.

## F2. "Show more" loses the keywords

`web/src/pages/Search.tsx:88-97` builds the catalogue link from the category, brand and
dates, but not from `interpreted.keywords`. A search for a wallet with an Intesa card
shows 23 matches; "show more" then opens the catalogue with all 4,800 wallets.

Do: add `q: base.interpreted.keywords.join(' ') || undefined` to that link. The catalogue
already treats `q` as "every word must occur", which is what the search did. With F1 in
place, skip `q` when `relaxed` has `"keywords"`.

Check: e2e — stub a response with `keywords: ['INTESA']` and `total: 40`; the "show more"
link contains `q=INTESA`.

## F3. Entry card opened from a link shows "not loaded" (optional)

Only if the backend ships `GET /api/items/{id}` (B8 in `FIX-BACK.md`). Ask the owner
before starting.

`web/src/lib/items.ts` finds an entry only among the results this tab has already
loaded. Open a card in a new tab, or send its link to someone, and the page says "This
entry is not loaded".

Do:

- `getItem(id)` in `web/src/api.ts` → `GET /api/items/${encodeURIComponent(id)}`.
- In `web/src/pages/ItemPage.tsx`: when `lookup(id)` returns nothing, fetch it, show the
  loading text meanwhile, and keep the current "not loaded" message for a 404 or an error.

Check: e2e — open `#/item/<a real id>` directly in a fresh page; the registry number is
visible.

## F4. Mark registry numbers that were guessed (optional)

Only if the backend ships the field (B8).

For 46 entries the scan was unreadable where the registry number is printed, and the
number was filled in from its neighbours. The card tells the user to quote that number to
the office, so a wrong one sends them on a wrong errand.

The server will add `number_guessed?: boolean` to `Item`.

Do: when it is true, show a short note under the number on the entry card and in step 1
of `Pickup` — for example: "This number was hard to read in the scan and may be off by
one. Give the office the date and the description as well." New string
`item.numberGuessed` in all 5 languages.

Check: e2e with a stubbed item that has `number_guessed: true`; the note is visible.

## Not doing

- `web/e2e/media.spec.ts:250` still says `15,560`, but that test stubs `/api/meta` itself,
  so it is correct as it is.
- The one `oxlint` warning in `web/src/i18n/index.tsx` (fast refresh) affects only the
  dev server.

## Handing work over

As before: push `feat/front` and message the owner; the owner merges, runs the checks and
deploys. One commit per item. Mock voice and photo with `page.route` — real calls cost
money and count toward the shared limit.
