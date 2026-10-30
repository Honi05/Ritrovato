# Decision log

Format: id, date, decision, why, when to revisit.

## D-001 · 2026-10-30 · Six agents, two writing branches

Orchestrator (main chat), `researcher`, `back-builder`, `front-builder`, `qa-deploy`,
`judge-pitch`. Only builders write code, each in its own folder (`server/`, `web/`) and
worktree, so conflicts are rare. Code goes to Codex and reading to DeepSeek: separate
pools that don't spend the Claude 5-hour window.

## D-002 · <date> · Stack — TBD

<Decide with the team. Candidates: Python 3.12 + FastAPI for `server/`, a static
frontend or Vite for `web/`; or Next.js. Criterion: what deploys fastest to our server
and what the builders know best.>

## D-003 · 2026-10-30 · Deploy to our own server

Docker Compose on `rilya-server` instead of Vercel etc.: there is capacity and the
process is proven on other projects. Details: `docs/OPERATIONS.md`.

## D-004 · 2026-10-30 · Web, not iOS

Judges open a link; they won't install TestFlight. The rules require a live link.

## D-005 · 2026-10-30 · All project files in English

The team may include other participants. Docs, code and commits are in English;
product UI in Italian and English.
