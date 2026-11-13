# Ritrovato — product

> "Ritrovato" is a working name; the owner may rename it. Official challenge 3,
> "Oggetti smarriti".

## One sentence

Anyone who loses something in Rome has to read a 500-page scanned PDF in Italian.
Ritrovato is a website where you describe, say or photograph the lost thing in your own
language and get the matching entries of the city's found-items registry in seconds.

## Problem

- Who suffers: tourists and residents who lost a wallet, phone, document, keys.
- How bad it is: the city's Reparto Oggetti Rinvenimenti publishes found items only as
  scanned PDFs with no text layer — 498 pages and 6,695 entries for 2026 alone (up to
  4 Nov), 697 pages for 2025. Not searchable, Italian only, bureaucratic wording
  ("PORTAFOGLI", "TELEFONO CELLULARE SENZA SIM"). Source: `docs/DATA.md`.
- Why it isn't solved today: the list is a scan; nobody digitised it.

## What the site does

Four ways into the same digitised catalogue (~15.5k entries, 2025–2026):

1. **Catalogue** — browse and filter by category, brand, date, keyword.
2. **Text** — free-form query in any language; an LLM turns it into catalogue filters.
3. **Voice** — microphone button; ElevenLabs transcribes, then the same as text.
4. **Photo** — upload a picture of the lost thing (or a similar one); a vision model
   describes it, then the same as text.

Interface in Italian, English, Spanish, French, German. Once a day the service checks the
city's page for a newer PDF and adds the new entries.

Every result shows its registry number, date found and PDF page, with a link to the
official source, plus how to collect it (office, fees, documents — with the source).

### Honesty rules

- The registry records type, brand and date found. It has **no colour, no place found,
  no photo**. When the user mentions those, the site says they are not recorded and
  searches without them — it never pretends to match them.
- Descriptions are shown in the original Italian (optionally with a translation);
  nothing is invented.

## Demo script (3 minutes, no slides)

The most important document in the project. Anything not in this script is out of MVP.

| Seconds | On screen | What we say |
|---|---|---|
| 0–20 | The official PDF: a scan, page 1 of 498 | "Lose your wallet in Rome and this is where the city tells you to look." |
| 20–60 | Site in English. Type: "I lost my black Samsung phone in October" | Chips show what the agent understood: phone · Samsung · Oct 2026, "colour is not recorded". List of matching entries with number, date, PDF page |
| 60–95 | Switch to Spanish, press the mic, say a query about a wallet with a driving licence | Transcript appears, then results. Voice by ElevenLabs |
| 95–135 | Upload a photo of a bunch of keys | "The model describes the photo, we search the registry" — description, then results |
| 135–160 | Open one entry | Registry number, link to the PDF page, how to collect: where, what it costs, what to bring |
| 160–180 | Footer: "Updated daily — last check today, N new entries" | "15,500 entries, five languages, refreshed every day. Next: alerts when your item shows up." |

## MVP — must-have

The orchestrator (timekeeper) ticks items as they are done.

- [ ] Site opens over HTTPS; catalogue browse with filters works in production.
- [ ] Text query in EN/IT returns relevant entries and shows what was understood.
- [ ] Voice query (mic button) works in the browser on a laptop and a phone.
- [ ] Photo query works.
- [ ] Interface in IT, EN, ES, FR, DE with a language switch.
- [ ] Entry card with source link and pickup instructions.
- [ ] Daily update job runs on the server; "last checked" is shown.
- [ ] Backup video recorded.

## Nice to have, if time allows

- Translated descriptions in results.
- "Not in the registry? Other places to ask" (ATAC, Trenitalia, airports) found via Exa
  with cited sources.
- Spoken answer (ElevenLabs TTS).
- "Notify me when something like this appears".

## Out of MVP — not doing

- Sign-up and accounts; claiming an item online.
- Conversational voice agent; phone calls of any kind.
- Matching by colour, place or photo of the found item — the registry has no such data.

## Sponsor prizes we are going for

- [ ] Main prize
- [ ] ElevenLabs — speech-to-text for the multilingual voice query (TTS answer if time allows).
- [ ] Exa — only via the nice-to-have "other places to ask".
- [ ] Avalanche — no.
