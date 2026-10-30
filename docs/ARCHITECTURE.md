# Architecture

> Template. The orchestrator fills it in during the first hour. "API contract" is the only
> link between `server/` and `web/`, so only the orchestrator changes it, in `main`.

## Components

| Part | Folder | Branch | What it does |
|---|---|---|---|
| Backend and agent | `server/` | `feat/back` | <API, agent logic, tools, Exa, ElevenLabs> |
| Frontend | `web/` | `feat/front` | <demo screens> |
| Deploy | `deploy/`, `docker-compose.yml` | `main` | Build and run on the server |

## Flow

```
user → web → POST /api/... → agent (LLM + tools) → Exa / ElevenLabs / ...
                                                → response → web
```

## API contract

All responses are JSON; errors are `{"error": "<code>", "message": "<text>"}`.

### `GET /api/health`
→ `{"ok": true}`

### `<METHOD> /api/<...>`
Request:
```json
{}
```
Response:
```json
{}
```

## Agent tools

| Tool | What it does | External API |
|---|---|---|
| `search_official` | Search official websites | Exa |
| `<...>` | | |

## Data

<Where state lives: memory / SQLite / file. For a hackathon — the simplest option.>

## Demo mode

<What gets stubbed on stage: stand-in number, prepared data, fixed script.
How to enable: `DEMO_MODE=1`.>
