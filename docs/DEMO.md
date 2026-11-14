# Demo and pitch

Written by `judge-pitch`, Sat 14 Nov 12:10. Format: 3 minutes live, no slides, one laptop,
then 2 minutes of questions. Language: English.

All text queries below were checked with `curl` against production `/api/search` at 12:05.
Voice and photo were not re-tested here (paid calls); dry-run them once before going on.

## Pitch text (3:00)

```
<0:00> [Tab 1: the official PDF, scroll fast]
       Lose your wallet in Rome, and this is where the city tells you to look.
       A scanned PDF. Over five hundred pages this year, Italian only, no text,
       no search. "PORTAFOGLI. TELEFONO CELLULARE SENZA SIM." Good luck, tourist.

<0:20> [Tab 2: Ritrovato, English]
       We read every page of it. Fifteen thousand seven hundred entries, 2025 and 2026.
       Now I just say what I lost, the way a person would.
       [type: I lost my black Samsung phone in October]
       An agent reads that and decides how to search the registry: phone, Samsung,
       October. And look at this line: "colour is not recorded". The registry has no
       colours, so it tells me, instead of pretending. Fourteen entries, out of fifteen
       thousand.

<0:50> [type: J'ai perdu mon iPhone rouge près du Colisée en novembre]
       Same thing in French, with two details the city never writes down: red, and
       the Colosseum. The agent drops both, says so, and finds three iPhones handed in
       this November. Three. That's a list you can actually check.

<1:15> [switch UI to Español, press mic, say: Perdí mi cartera con el carnet de conducir la semana pasada]
       Voice, in Spanish. ElevenLabs transcribes it, the same agent turns it into
       filters: wallet, driving licence, last week. [results] Still too many?
       [tap one "Narrow it down" chip] One tap, no extra AI call.

<1:45> [photo: pick the keys photo from the gallery]
       Or you don't have the words at all. A photo of the thing, or one like it.
       An ElevenLabs agent describes it, and we search on that description.

<2:10> [open one entry]
       Every answer is a real registry line: number, date found, the PDF page, a link
       to the official source. And how to get it back: where to go, what it costs,
       what to bring. We never invent an item; if it's not in the registry, we say so.

<2:35> [scroll to footer]
       The city publishes a new PDF every week or so. Our server checks every day,
       reads the new pages and adds them. Five languages, fifteen thousand items,
       every one traceable to the city's own document.
       Next: "tell me when something like mine shows up". That's Ritrovato.
```

If running long: cut the photo step (1:45–2:10) first, then the narrow-down chip.

## Click script

Pre-open three tabs, zoom 125–150%.

1. Tab 1: `https://www.comune.roma.it/web-resources/cms/documents/Rinvenimenti_01012026_11112026.pdf`
   (official PDF, 510 pages). Scroll fast for 3 seconds.
2. Tab 2: `https://ritrovato.quietunit.com`, UI language English.
   Type exactly: `I lost my black Samsung phone in October`
   Expected: **14** results; chips phone · SAMSUNG · Oct 2026; "colour not recorded".
3. Same tab, clear, type exactly: `J'ai perdu mon iPhone rouge près du Colisée en novembre`
   Expected: **3** results (Apple iPhones, 3–9 Nov); colour **and** place flagged as not recorded.
   This is the wow moment; pause on it.
4. Switch UI to Español. Mic, say: `Perdí mi cartera con el carnet de conducir la semana pasada`
   Expected (text check): **38** results, wallet + PATENTE, last week. Tap one narrow-down chip.
   If the mic fails: type the same sentence, say "same thing typed", move on.
5. Photo: gallery picker, keys photo (have it in the laptop's Pictures/Desktop already).
   If it errors or takes over ~10 s: skip, say "photo works the same way", go to step 6.
6. Open the first result of step 3 (`2026-6829-502`, iPhone, 9 Nov, page 502). Show number,
   page, source link, pickup box (€4.60 custody + €5.80 search; ID documents free).
7. Scroll to footer: total count and last check.

Spare text query if one fails or a judge asks for another:
`my backpack with a laptop, lost at Termini last week` → **10** results, place flagged.

Do **not** use on stage (they work, but the agent has to widen the search, which looks weak
in a 3-minute demo): `lost my Ray-Ban sunglasses` (brand + keywords dropped, 254),
`Ho perso il portafoglio con la carta Intesa a novembre` (keyword dropped, 64),
`Ho perso le chiavi della macchina Fiat a ottobre` (brand dropped, 45),
`Perdí mi cartera con el carnet de conducir` without a date (2,631).

## If something fails

| Failure | What to do |
|---|---|
| AI provider slow or down | Nothing visible to do: the server falls back ElevenLabs agent → DeepSeek → keyword mapping. Results still come back; chips may be coarser. Keep talking. |
| Mic or photo fails | Type the same sentence. Say "same pipeline, typed". Never retry twice on stage. |
| A query hangs over ~15 s | Worst-case timeout is 14 s; then it answers from the fallback. Use the spare query. |
| Venue Wi-Fi down | Phone hotspot (set up before). If that fails too: open the backup video tab and narrate over it. |
| 429 "too many requests" | Per-IP limit is 200 paid calls / 10 min; rehearsals should not hit it. If it does: backup video. |

Cache trick: run steps 2, 3 and the spare query once, 10 minutes before going on. Repeated
text queries come from the cache in ~0.35 s instead of ~2 s.

## Before going on stage

- [ ] Three tabs open (PDF, site in English, backup video), zoom large, laptop on charger,
      notifications and Do Not Disturb on.
- [ ] Mic permission already granted to the site in this browser (do one voice query in rehearsal).
- [ ] Keys photo in an easy-to-find folder.
- [ ] Text queries pre-warmed (see cache trick).
- [ ] Footer: production has `UPDATE_DISABLED=1`, last check shows **13 Nov 20:46**. Do not say
      "last checked today" unless the owner re-enables the job and the footer shows today.
      Safer line (used above): "our server checks every day".
- [ ] Phone hotspot ready.

## Judge questions and answers

| Question | Answer |
|---|---|
| How is this better than ChatGPT? | ChatGPT can't read a 500-page scan it doesn't have and will happily invent a match. We OCR'd the whole registry into a database; the model only turns your words into filters. Every result is a real registry line with its PDF page. |
| Does it hallucinate? | The model never writes results; it only produces filters (category, brand, dates, Italian keywords). Items come from SQLite. If nothing matches, it widens the search and shows which filter it dropped. |
| The registry has no colour, place or photo. Isn't that a problem? | It's the city's data, not ours. We say so on screen ("colour is not recorded") instead of faking a match. Type, brand and date usually cut 15k to a handful; then you check in person. |
| What about OCR errors? | Number coverage ~99% (120 missing out of ~15.7k, 46 inferred and flagged). Typos like "APPLE \| PHONE" exist; brand detection and keyword search are tolerant of them. The PDF page link lets you verify every entry. |
| What does it cost per search? | One small LLM call per text query, a fraction of a cent; we did not measure it precisely. Repeated queries are cached, and paid calls are rate-limited per IP. The catalogue itself is free to serve. |
| Privacy: the PDF contains document numbers. | The police already mask them (`CA916****`), and we strip document, card and IMEI fragments from public descriptions anyway. Uploaded audio and photos are processed in memory and never stored. No accounts. |
| Why an ElevenLabs agent and not a plain LLM call? | ElevenLabs runs all three inputs: Scribe for speech in five languages, an agent for query interpretation, an agent with file input for the photo. One platform, one key; DeepSeek is only the fallback. |
| Is the daily update real? | Yes: a background job checks the city page, sees a new PDF name, OCRs only the new pages with Tesseract and inserts new entries. It's paused right now so the demo data doesn't shift under us. |
| Did you use Exa? | No. We kept to the core job; Exa was planned for "other places to ask" (ATAC, airports) and cut at feature freeze. |
| What's next, who pays? | Alerts when a matching item appears, and the same pipeline for ATAC and Trenitalia lost-and-found. The natural customer is the Comune itself: it already publishes the data; we make it usable. |

## Backup video (1–2 min)

Script: `docs/DEMO-VIDEO.md` (~50 s, titles and music, real screen recordings of production).
It matches this pitch: Samsung query → voice / photo / chips → entry card → footer.
Link to the file: <add once recorded>.

## Submission (by 14:00)

- [ ] Link to the live project: https://ritrovato.quietunit.com
- [ ] Repository (public? check `server/seed/oggetti.sqlite` has no unmasked numbers first)
- [ ] Video
