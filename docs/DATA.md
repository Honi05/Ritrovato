# Data

## Source

Roma Capitale, Polizia Locale — Reparto Oggetti Rinvenuti. Service page
`comune.roma.it`, scheda servizi `INF39645`. The list of found items is published as one
PDF per year, e.g. `Rinvenimenti_01012026_04112026.pdf` (the end date in the name moves
as the list grows; it is updated every few days).

The PDFs are scans without a text layer: 2026 — 498 pages up to 04/11/2026; 2025 — 697 pages.

## How the snapshot was built (before the hackathon)

1. OCR with macOS Vision (a Swift tool, not in the repo) → `raw/ocr_<year>.txt`, lines of
   `x y text`.
2. `server/ingest/parse.py` groups lines into records by the date column and writes SQLite.

The originals (PDFs, raw OCR) are in `data/oggetti/` on the owner's machine and in the
team repo `Honi05/Lost-items`; `data/` is not in this repo's Git. macOS Vision does not
run on the Linux server — the daily update uses a different OCR (D-007).

## Table `oggetti`

`server/seed/oggetti.sqlite`, ~15.5k rows (6,695 for 2026, 8,865 for 2025).

| Column | Meaning |
|---|---|
| `year` | Year of the list |
| `reperto` | Registry number of the item |
| `date` | Date found, text `dd/mm/yyyy` |
| `descr` | Description as printed, Italian, upper case |
| `num_guessed` | 1 if the number was missing in OCR and inferred (~1%) |
| `page` | Page of the PDF |
| `category` | One of 15, assigned by regex (below) |
| `tags` | Comma-separated categories of everything in the record |
| `brand` | Only for phones, electronics, bags, watches, glasses |

Primary key: `(year, reperto, page)`.

Categories: `wallet`, `id_document`, `payment_card`, `bag`, `phone`, `other`, `keys`,
`document_other`, `electronics`, `clothing`, `glasses`, `sim`, `watch_jewelry`, `money`,
`vehicle`.

## Limits — design around them

- No colour, no place found, no photo. Only type, brand, date.
- One record often bundles several things ("PORTAFOGLI - CARTA DI CREDITO - PATENTE").
- OCR typos exist ("APPLE | PHONE"); exact-match search misses them.
- Registry wording differs from everyday Italian: "PORTAFOGLI", not "portafoglio".
- Document numbers in the list are already masked by the city with `*`.

## Collecting an item

From the service page (verify the current text before showing it — `docs/RESEARCH.md`):
custody fee €4.60 plus search fee €5.80; identity documents are returned free; items are
kept on a 30-day deposit basis (€17.40); contact `oggettismarriti@comune.roma.it`.
