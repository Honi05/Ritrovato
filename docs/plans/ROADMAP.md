# Plan

> Template. The orchestrator fills it in during the first hour for the chosen idea.
> Each block's detailed task: `docs/plans/blocks/NN-*.md` from `_TEMPLATE.md`.

| # | Block | Branch | Executor | Depends on |
|---|---|---|---|---|
| 00 | Skeleton: `server/` and `web/` layout, `/api/health`, contract, Compose | main | orchestrator | — |
| 01 | First "hello world" deploy over HTTPS | main | qa-deploy | 00 |
| 02 | Agent: LLM + search tool (Exa), one script endpoint | feat/back | back-builder | 00 |
| 03 | Script screen on a contract stub | feat/front | front-builder | 00 |
| 04 | Voice: ElevenLabs in the script | feat/back | back-builder | 02 |
| 05 | Integration: frontend on the real API, full script in production | main | orchestrator + qa-deploy | 02, 03 |
| 06 | Demo data and demo mode | feat/back | back-builder | 05 |
| 07 | UI polish | feat/front | front-builder | 05 |
| 08 | Pitch, video, submission | — | judge-pitch + owner | 05 |

In parallel: 02 ∥ 03, then 04 ∥ 07.
Critical path: 00 → 01 → 02 → 05 → 08.
