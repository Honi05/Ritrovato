# Data for "Oggetti smarriti" (challenge 03)

What we already have, prepared before the hackathon. The data files themselves are
not in this repo yet (see "Open questions").

## Source

- Roma Capitale, Polizia Locale — Reparto Oggetti Rinvenuti. Public lists of found
  items, published as PDFs on comune.roma.it (service page "scheda-servizi INF39645").
- Two files downloaded on 2026-11-10:
  - `Rinvenimenti_01012025_31122025.pdf` — 697 pages, items 02/01/2025 – 30/12/2025.
  - `Rinvenimenti_01012026_04112026.pdf` — 498 pages, items 02/01/2026 – 04/11/2026.
- The PDFs are **scans with no text layer**, so they were OCR'd.
- The list is live: the city republishes it every few days. Re-download and re-run the
  pipeline before the demo to include the newest items.

## Pipeline

1. **OCR** — macOS Vision (`VNRecognizeTextRequest`, language `it-IT`, accurate mode)
   via a small Swift tool. Output: one line per text fragment, `x y text` (normalized
   page coordinates). ~5–10 min for both years on a MacBook. Output files
   `raw/ocr_2025.txt`, `raw/ocr_2026.txt`.
2. **Parse** — `parse.py` (Python, stdlib only) groups fragments into records: each
   record is anchored by its date (right column); the item number (left column) and
   description (middle column) attach to the nearest date above within a 0.015
   tolerance. Missing numbers are inferred as previous + 1 and flagged.
3. **Classify** — regex rules on the description assign a category, tags (all
   categories mentioned) and, for phones/electronics/bags/watches/glasses, a brand.
4. Result: SQLite file `oggetti.sqlite`. Rebuild: `python3 -I parse.py`.

## Schema

Table `oggetti`, primary key `(year, reperto, page)`:

| Column | Meaning |
|---|---|
| `year` | List year (2025, 2026) |
| `reperto` | Item number in the police register |
| `date` | Date found / registered, `DD/MM/YYYY` (text — convert before sorting) |
| `descr` | Original description, e.g. `TELEFONO CELLULARE - APPLE IPHONE 13 - ...` |
| `num_guessed` | 1 if the number was inferred, not read |
| `page` | Source PDF page |
| `category` | Main category (from the first item in the description) |
| `tags` | Comma-separated categories of all items in the record |
| `brand` | Brand, only for branded categories; else NULL |

## Numbers

- **15,560 records**: 8,865 for 2025, 6,695 for 2026.
- Number coverage ~99%: 38 missing numbers in 2025, 82 in 2026; 46 inferred.
- Categories: wallet 4,831 · id_document 2,273 · payment_card 1,910 · bag 1,476 ·
  phone 1,005 · other 975 · keys 958 · document_other 793 · electronics 340 ·
  clothing 293 · glasses 246 · sim 217 · watch_jewelry 103 · money 100 · vehicle 40.
- Top brands: Apple 530 · Samsung 269 · Redmi 106 · Motorola 46 · Oppo 30 · Huawei 24.

## Limits

- **Only type + brand + date.** No color, no place where it was found, no photo.
- OCR typos exist (e.g. `MEI` for IMEI, `APPLE | PHONE`). Search must be fuzzy.
- Many records bundle several items (a wallet with cards and documents in one line).
- **Privacy:** 8,812 records contain partial document/card numbers (`Nr: CA916****`),
  already masked by the police. Do **not** show them in the UI. They can be used
  server-side to confirm a match ("does your ID start with CA9…?"), never displayed or
  returned in full. The challenge requires no personal data exposure.

## How to pick up an item (from the city page, checked 2026-11-10)

- Contact: oggettismarriti@comune.roma.it.
- Fees: €4.60 custody + €5.80 search; ID documents are free; €17.40 for a 30-day
  deposit. Re-check on the official page before quoting in the product.

## Suggested use in the agent

The agent narrows the search by asking questions (what type, brand/model, when lost)
instead of expecting an exact match, then returns candidate item numbers with the
source page and the pickup procedure.

## Open questions

- Commit the data to this repo? `oggetti.sqlite` is 2.7 MB, OCR text ~3 MB, PDFs ~7 MB.
  The SQLite contains the masked document numbers — decide before committing.
- Add `parse.py` and the OCR tool here so anyone can rebuild.
