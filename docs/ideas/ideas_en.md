# Agentic Hack Rome — project ideas

**Theme:** solve Rome's problems with AI agents.
**Format:** 13–14 November, Urbe Hub (Testaccio), submission Saturday 14:00. 3-minute live demo, no slides.
**Sponsors:** Exa (search for agents), ElevenLabs (voice), team1 / Avalanche (blockchain).

---

## 1. "Ti chiamo io" — the agent that makes the call for you ⭐
**Problem:** booking a medical appointment through the Regione Lazio CUP means weeks of waiting and hours on hold. Elderly people and foreigners give up.
**Solution:** the user says by voice, in any language, "I need an ultrasound, here's the prescription". The agent uses Exa to find where and how to book (ASL, clinics in convenzione), calls by itself with an ElevenLabs voice agent speaking Italian, and returns the result: date, address, what to bring.
**Demo:** a phone rings on stage and the agent books by voice with the "front desk".
**Prizes:** main, ElevenLabs, Exa.

## 2. "Permesso Pilot" — bureaucracy guide for foreigners
**Problem:** codice fiscale, residenza, permesso di soggiorno, tessera sanitaria — confusing procedures, Italian only.
**Solution:** a voice agent in the user's language; Exa pulls current rules from official sites. Output: personal checklist, filled-in forms, PEC drafts.
**Risk:** similar to the previous edition's winner (Permesso Digitale).
**Prizes:** main, ElevenLabs, Exa.

## 3. "Segnala Roma" — reports that actually arrive
**Problem:** potholes, garbage, broken streetlights — nobody knows whom to report to, and reports get lost.
**Solution:** photo or voice note → the agent identifies the issue and the responsible office (Municipio, AMA, Roma Capitale), writes a formal report and tracks the reply. Every report is recorded on Avalanche: immutable and public.
**Prizes:** main, Avalanche, Exa.

## 4. "Sciopero?" — the strike-day agent
**Problem:** ATAC/Trenitalia strikes break your commute.
**Solution:** the agent warns in advance which of your routes will stop and plans alternatives with Roma Mobilità open GTFS data.
**Prizes:** Exa.

## 5. "Ricorso" — contest a ZTL fine
**Problem:** ZTL and parking fines; some can be contested, but nobody knows how.
**Solution:** upload the fine → the agent checks the grounds (notification deadlines, signage, case law via Exa) and drafts the ricorso.
**Prizes:** Exa.

## 6. "Affitto Sicuro" — rental listing checker
**Problem:** students and foreigners are scammed en masse: fake apartments, deposits before viewing, irregular contracts.
**Solution:** paste the listing link → the agent uses Exa to find the same photos and text in other listings, compares the price to the area average and reviews the contract (cedolare secca, registration, deposit ≤ 3 months). Output: traffic light plus questions for the landlord.
**Demo:** "🔴 these photos already appear in 4 listings in Milan".
**Prizes:** main, Exa.

## 7. "Voce di Quartiere" — what the city actually decided
**Problem:** Municipio and Roma Capitale decisions end up in PDFs nobody reads.
**Solution:** enter your street → the agent finds recent decisions about your neighborhood and sends a 60-second voice podcast (ElevenLabs) in your language.
**Demo:** enter the venue address and the episode about Testaccio plays in the room.
**Prizes:** main, ElevenLabs, Exa.

## 8. "Cicerone Vero" — the guide that leads you away from the crowds
**Problem:** overtourism — crowds at Trevi and the Colosseum, empty streets next door.
**Solution:** voice guide: "I'm at the Pantheon, I have 2 hours" → a route away from the crowds with narration in your earbuds and only authentic local places. Spreads tourists across the city.
**Prizes:** ElevenLabs, Exa.

## 9. "Nonno Digitale" — a phone line for the elderly
**Problem:** pensioners can't cope with SPID, IO, INPS and are the main target of phone scams.
**Solution:** a regular phone number, no app. Talk like you would to a grandchild: "I got a letter from INPS, what is it?" — the agent explains and suggests the next step. If someone asks for codes or money, it warns that it's a scam.
**Demo:** a call to the number from a phone, on stage.
**Prizes:** main, ElevenLabs.

## 10. "Bando Hunter" — the money you're not claiming
**Problem:** grants and benefits from the city, Lazio and the EU go unclaimed because they're impossible to find.
**Solution:** a 5-minute voice interview → the agent uses Exa to find matching bandi, checks eligibility and shows deadlines.
**Demo:** "student, 24, renting in Pigneto" → "you qualify for 3 programs worth €4,200, first deadline in 12 days".
**Prizes:** main, Exa.

---

## Reusable data: Urbe Hub's "Quartieri di Roma 2026"

[github.com/urbe-hub/quartieri-roma-2026](https://github.com/urbe-hub/quartieri-roma-2026) (live: [romaquartieri.it](https://romaquartieri.it/)) is the organizers' own open project: a map of Rome's new administrative geography (delibera 150/2026). Code is MIT; data is open (GeoRoma, OSM ODbL, MIM and Ministero della Salute IODL 2.0, AGENAS, Regione Lazio, GHS-POP CC BY), credit required, Urbe Hub logo not reusable.

**What's in `data/`:**
- 457 area polygons (quartieri, rioni, zone) + 15 municipi, GeoJSON.
- ~18 service categories as points: pharmacies, nidi, schools, Case della Comunità, pronto soccorso, libraries, markets, sport, parks, centri anziani, consultori, museums.
- School details: places, closures for works, Scuola in Chiaro links.
- Street index (14,908 streets) split by municipio.
- 15-minute coverage gaps on 250 m hexagons, with population.

**How to use it:** as agent tools rather than forking the UI (one 6,700-line template). Point-in-polygon → "which quartiere/municipio is this address in"; nearest service by category with its source; street name → coordinates. For visuals, link to their site's deep links (`#15=lat,lon` opens the 15-minute walk, also `#via=`), with a recorded fallback.

**Per idea:**
- **No. 3 Segnala Roma** — strong fit: address → correct municipio under the new boundaries → the right office to report to.
- **No. 7 Voce di Quartiere** — strong fit: street → quartiere/municipio, the key for filtering decisions; plus "what services are here / missing" for the episode.
- **No. 9 Nonno Digitale** — good fit: "where's the nearest pharmacy / Casa della Comunità / centro anziani?" answered by voice with an address and a source.
- **No. 1 Ti chiamo io** — supporting: pick the nearest Casa della Comunità or facility before the call.
- **No. 2 Permesso Pilot** — supporting: which municipio office handles your residenza.
- **No. 8 Cicerone Vero** — weak: museums, parks, markets per quartiere for routes away from the center.
- **No. 4, 5, 6, 10** — little or no use.

Pitch angle: building on the organizers' own open data.

---

## Favorites
- **No. 1 and No. 9** — best demo: a real phone call on stage.
- **No. 10** — a concrete euro amount on screen, a clear outcome.

## To check before the hackathon
- Whether ElevenLabs outbound calls work to Italian numbers.
- What is actually available in Roma Mobilità open data (No. 4).
- How Roma Capitale delibere are published (No. 7) and whether a registry of bandi exists (No. 10).
- The project must be a web app with a live link, not iOS.
- Whether reusing pre-existing open code/data (e.g. quartieri-roma-2026) is allowed.
