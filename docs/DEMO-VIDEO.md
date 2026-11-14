# Demo video — proposal for approval

Status: **draft, needs teammate approval.** Not committed yet.

Backup video required by the hackathon (1–2 min, submitted with the link and repo by Saturday 14:00). We aim for **~50 seconds**, no voice-over, titles and music only.

## Concept: "There is a problem, there is a solution"

Short, simple, readable on mute. The AI-generated shots only set the scene around the problem. Everything about the product is a real screen recording of the live site: https://ritrovato.quietunit.com

## Storyboard

| Sec | Shot | Title on screen | Source |
|---|---|---|---|
| 0–5 | A hand pats an empty jacket pocket on a Roman street | "Lost something in Rome?" | **Clip 1, rendered on Modal** |
| 5–10 | The official PDF, fast scroll through scanned pages | "The city's answer: 498 scanned pages. Italian only." | Screen recording (real PDF) |
| 10–14 | Logo card | "Ritrovato" | Title card |
| 14–28 | Site in English. Type "black Samsung phone, October". Chips appear (phone · Samsung · Oct 2026), then 14 matching entries | "Describe it in your language" | Screen recording |
| 28–38 | Three quick cuts, ~3 s each: microphone (Spanish), photo of keys, narrow-down chips | "Say it. Photograph it." | Screen recording |
| 38–44 | One open entry: registry number, PDF page, link to the official source, how to collect | "Every answer links to the official registry" | Screen recording |
| 44–50 | A hand takes a wallet across a counter | "15,700 items · 5 languages · updated daily" + URL | **Clip 2, rendered on Modal** |

If we need it shorter: cut the 28–38 block (voice and photo) and we get ~35 seconds.

## Modal clips

- Reuse the Wan2.2 image-to-video app from the Marta project (`zimage/modal/video_app.py`), Lightning mode: 5 s clip, ~96 s generation, ~$0.23 per clip (measured 2026-09-18). Model weights are already cached on the Modal volume, so no long cold start.
- Flow: still frame (image model) → `video_app.py` with a `job.json` → clip → ffmpeg assembly with titles and music.
- **Hands and back-of-head shots only, no faces.** Image-to-video tends to drift faces within 5 s; hands hold up.
- Budget: under $1 for both clips including 2–3 seeds each to pick the best one.
- Assembly is plain ffmpeg (1080×1920 vertical or 1920×1080), no extra tools.

## Honesty rules for the video

- AI-generated clips show only the story around the problem. Nothing about the product is generated; it is all recorded from the live site.
- Show the "colour is not recorded" note: the registry has no colour, place or photo, and the site says so instead of pretending to match.
- Never show partial document, card or IMEI numbers.

## Before recording

- [ ] Dry-run voice and photo once: each real call costs money and counts toward the 20 calls / 10 min limit.
- [ ] Block 07b (narrow-down chips) merged, or drop that cut.
- [ ] Confirm the product name "Ritrovato" (still a working name).
- [ ] Record on a phone for the mobile shots, laptop for the PDF.
- [ ] Final URL and footer count checked on production.

## Questions for the team

1. Is the structure and length OK, or shorter (~35 s)?
2. Voice-over (generated with ElevenLabs) or titles and music only?
3. Which Modal profile do we run the clips on? Each run is paid.
4. Vertical or horizontal format?
