# Design mockups

Static HTML mockups of Ritrovato: six linked pages, no build step. All entries, dates and
counts are real rows from `data/oggetti/oggetti.sqlite`; `[BRACKETS]` mark facts still to
confirm (opening hours, delegation rules, operator IDs).

| Page | File | Language |
|---|---|---|
| Home / search | `index.html` | EN |
| Results for "black Samsung phone, October" | `results.html` | EN |
| Item 6544 + how to collect | `item.html` | EN |
| Voice query | `voice.html` | ES |
| Photo query | `photo.html` | EN |
| Operator back-office (photo entry, returns) | `operator.html` | IT |

Look: found-property tag. Grid-paper ground `#E9EAE5`, ink `#111111`, manila `#E6D3A0`,
signal orange `#FF5A1F`; Archivo (headings, body) and IBM Plex Mono (registry numbers).

## Run

```sh
npm install
npm run serve        # http://localhost:4321
```

Or just open `index.html` in a browser.

## Tests (Playwright)

```sh
npx playwright install chromium   # once
npm test
```

Runs on desktop (1280px) and phone (Pixel 7) for every page:
page loads with one `h1` and no console errors; every internal link resolves; no
horizontal scroll and nothing crosses the 16px side gutter; no IMEI or document numbers
in the visible text; no serious or critical axe accessibility violations. Plus click-through
flows: home → results → item → back, mic → voice, camera → photo, Operators → back-office.
