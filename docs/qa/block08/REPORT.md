# Block 08 — production integration (https://ritrovato.quietunit.com, main 69d0186)

## E2E (web/e2e against production, throwaway config, 2 projects desktop 1280x900 + Pixel 7)
70 passed, 0 failed (34.5 s). Note: many media tests stub the API, so voice/photo UI paths are
covered, real voice/photo were checked by hand below.

## Demo script by hand
| Step | Result |
|---|---|
| Health, meta | OK. 15,732 entries, last check 2026-11-13, 0 new |
| Demo query EN (phone, Samsung, Oct 2026, colour ignored) | PASS. 14 results, chips + "Colour is not recorded" note. 0.09 s first and repeat (cached) |
| IT "ho perso il portafoglio con la patente" | PASS. wallet + PATENTE, 2631 total, 2.1 s |
| IT "mazzo di chiavi" | PASS. keys, 982, 1.8 s |
| EN "red Nike backpack lost last week" | PASS: relaxed [keywords, brand], colour ignored, 29 results, 2.0 s |
| Chips narrow ("Narrow it down": With SIM / No SIM / Foreign SIM, Lost on date) | PASS in e2e (Intesa chip narrows and restores; date range = date + 14 d) |
| Voice (1 real call, ES m4a via macOS say) | PASS. Transcript "He perdido mi cartera con el carnet de conducir" -> wallet + PATENTE, 2631 results. Latency not captured (script bug) |
| Photo (1 real call, drawn keys jpg) | PASS. description "Chiave" -> keys, 982, 4.3 s |
| Entry card (UI) and GET /api/items/2026-6544-481 | PASS. 200 in 0.1 s, card shows pickup info and PDF p. 481 link |
| Unknown id /api/items/2026-nonexist-1 | PASS. 404 {"error":"not_found"} |
| 390x844 and 1280x900 layouts | PASS. No horizontal scroll (scrollWidth 390 / 1280) |

## Bugs
- Cosmetic: "last week" query gives date_to 2026-11-21 (future; today 2026-11-14) and date_from 2026-11-01. Harmless to results; chip would show a future range.
- Cosmetic/perf: non-demo text searches take about 2 s (LLM); demo query is fast only because cached. Use the demo query verbatim on stage; do a warm-up before.
- Not verified: real microphone in a phone browser (headless cannot). Test once on an actual phone over HTTPS.

No blockers for the demo.

Screenshots: docs/qa/block08/{phone,desktop}-{1-home,2-results,3-entry}.png
