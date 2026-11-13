# Block 07b — "Narrow it down" chips per category

Depends on: 03. Executor: front-builder/Sonnet. Branch: `feat/front`. Folder: `web/`.
Do it after block 07, or before it if 07 is blocked.

## Goal

A user who searched "lost my wallet" sees ~4800 wallets. One or two taps on chips like
"Intesa card" or "Driving licence" bring that down to a handful.

## Why it works

The registry has no colour, place or brand for most items, but the description lists
**what was inside or what kind of thing it is**, in fixed Italian words, for example:

```
PORTAFOGLI - CARTA DI CREDITO ITA INTESA SAN PAOLO - CARTA IDENTITA' - PATENTE DI GUIDA
TELEFONO CELLULARE CON SIM ESTERA - SAMSUNG
```

`GET /api/items?q=INTESA PATENTE&category=wallet&date_from=...` already AND-matches each
word of `q` against the description. No contract change needed.

## Do

1. Under the "what we understood" chips, when `interpreted.category` has an entry in the
   table below, show a row "Narrow it down:" with toggle chips.
2. Tapping a chip calls `GET /api/items` with the current `interpreted` filters
   (`category`, `brand`, `date_from`, `date_to`), and
   `q = [...interpreted.keywords, ...selectedChipWords].join(" ")`.
   It is free and instant — no AI call. Tapping again removes the word.
3. Show the new total on the results. If it is 0, keep the chip selected, show
   "No entries with this — try removing a filter", and do not auto-remove anything.
4. Chip labels in all 5 languages (`web/src/i18n/`); the `q` word stays Italian as given.
5. Also offer, for every category: "Lost on <date>" date picker → sets
   `date_from = that date`, `date_to = date + 14 days` (items are logged after they are
   found, never before you lost them).

Chips (label → `q` word). Keep each list at most 8; order as below.

| category | chips |
|---|---|
| `wallet`, `payment_card` | Intesa → `INTESA` · UniCredit → `UNICREDIT` · Poste/Postepay → `POST` · BNL → `BNL` · Revolut → `REVOLUT` · Foreign card → `ESTER` · ID card → `IDENTITA` · Driving licence → `PATENTE` |
| `id_document` | ID card → `IDENTITA` · Driving licence → `PATENTE` · Passport → `PASSAPORTO` · Residence permit → `SOGGIORNO` · Health card → `SANITARIA` · Foreign → `ESTER` |
| `phone` | With SIM → `CON SIM` · No SIM → `SENZA SIM` · Foreign SIM → `SIM ESTERA` |
| `bag` | Backpack → `ZAINO` · Shoulder bag → `BORSELLO` · Suitcase → `TROLLEY` · Pouch → `POCHETTE` · Had a wallet inside → `PORTAFOGLI` · Had keys inside → `CHIAVI` |
| `glasses` | Prescription → `DA VISTA` · Sunglasses → `DA SOLE` |
| `electronics` | Earphones → `AURICOLARE` · Tablet/iPad → `IPAD` · Laptop → `PORTATILE` · E-reader → `LETTORE LIBRI` |
| `keys` | (no chips — the registry only says "CHIAVI"; show the date picker only) |

Every chip word was checked against the data (e.g. wallet + `INTESA` = 134, `BNL` = 40,
phone + `SENZA SIM` = 583). Multi-word values (`CON SIM`, `DA VISTA`) are fine: `q` is
split on spaces and each word must match, which still narrows correctly.

## Acceptance

- `npm run build` and the existing e2e suite — green.
- New e2e (against the local backend, no mocks needed, no paid calls):
  search "portafoglio" → tap "Intesa" → total drops below 200 and every visible
  description contains "INTESA".
- Manual: phone layout, chips wrap, no horizontal scroll.

## Don't

Touch files outside `web/`; call `/api/search` per chip tap (that costs an AI call);
show document numbers.

## Timebox

90 minutes. If you can't make it, stop and report `BLOCKED` with the reason.
