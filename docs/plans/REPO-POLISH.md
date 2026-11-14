# Repo polish before submission

Goal: a judge who opens the GitHub page understands the project in one minute and finds
the live link, the demo and the code. Budget: 30–40 min in total, after block 08. No code
refactoring, no history rewrite.

| # | Step | When | Who | Done |
|---|---|---|---|---|
| R1 | README for judges: pitch, live link, features, honesty rules, diagram, run locally, team | now | orchestrator | [x] |
| R2 | Secret check: no keys, `.env` or server IPs in tracked files (`git grep` for key patterns and IPs) | now | orchestrator | [x] clean |
| R3 | Screenshot or GIF from a phone (text search → results → entry card) at `docs/img/demo.gif`, linked at the top of the README | after block 08 | owner | [ ] |
| R4 | Link to the backup video in the README | after the video is recorded | owner | [ ] |
| R5 | Move working files to `docs/internal/`: `FIX-BACK.md`, `FIX-FRONT.md`, `NEXT-FRONT.md`, `DEMO-VIDEO.md`, `ideas/`. Fix links to them | after FIX-FRONT is merged (the teammate reads it now) | orchestrator | [ ] |
| R6 | Leave `designmockups/` and give it one line in the README ("early HTML mockups") | with R5 | orchestrator | [ ] |
| R7 | GitHub repo description, website field and topics (`hackathon`, `rome`, `elevenlabs`, `fastapi`, `react`) | before 14:00 | owner (repo settings) | [ ] |
| R8 | Check the repo is public and the README renders; open the live link from a phone | 13:30 | owner | [ ] |

Out of scope until after the hackathon: removing the 32 MB tracked under `data/`
(in `.gitignore` but committed), badges, a logo, a docs site.
