# Block 04+05 — Voice (ElevenLabs Scribe) and photo (ElevenLabs Agent)

Depends on: 02. Executor: DeepSeek via `scripts/ds_code.py`, accepted by orchestrator.
Branch: feat/back. Folder: server/.

## Goal

`POST /api/search/voice` and `POST /api/search/photo` work per the contract: audio →
transcript → `interpret.search`; image → Italian description → `interpret.search`.

## Context

- Contract: `docs/ARCHITECTURE.md` → `POST /api/search/voice`, `POST /api/search/photo`,
  error codes, `SearchResponse.transcript` / `.description`.
- Recipes: `docs/RESEARCH.md` → "ElevenLabs Scribe" and "Photo -> description via
  ElevenLabs Agent". Working probe for the photo flow: `scripts/el_photo_probe.py`.
- Shared pipeline: `server/app/interpret.py` → `search(text, lang)` (do not change it).
- Env: `ELEVENLABS_API_KEY`, `ELEVENLABS_PHOTO_AGENT_ID`
  (default `agent_1001m7b5fdv5ese97f0hxxjgd9x5`). Use `httpx` + `websockets`
  (add `websockets` to `requirements.txt`); no vendor SDK.

## Do

1. `server/app/voice.py`: `transcribe(data: bytes, filename, content_type) -> str` —
   Scribe `model_id` `scribe_v2`, no `language_code`; timeout 30 s.
2. `server/app/photo.py`: `async describe(data: bytes, content_type) -> str | None` —
   the agent flow from the recipe; overall timeout 20 s; answer `NESSUN OGGETTO` → None.
3. Routes in `server/app/main.py` replacing the 501 stubs (keep everything else in
   `main.py` exactly as it is — edit only those two route functions and imports):
   - voice: limit 10 MB → 413 `too_large`; empty transcript → 200 with no items and
     `transcript: ""`; ElevenLabs error / no key → 502 `upstream_failed`.
   - photo: jpeg/png/webp only → else 400 `bad_request`; ≤ 8 MB → else 413; description
     None → 200 with no items, `description: null`; errors → 502 `upstream_failed`.
   - Success: `{**interpret.search(text, lang), "transcript": text}` /
     `{..., "description": text}`.
   Use the existing `HTTPException(status, "code: message")` convention in `main.py`.
4. Tests `server/tests/test_voice_photo.py`, no network (monkeypatch `voice.transcribe`,
   `photo.describe`, and the HTTP layer inside them): success paths, 413, 400, 502,
   empty transcript, `NESSUN OGGETTO`.

## Acceptance

- `cd server && .venv/bin/python -m pytest -q` — all green (existing 11 + new).
- Live, orchestrator: a Spanish recording → transcript + wallet entries; the keyring photo
  → description + `keys` entries.

## Don't

Touch files outside `server/`; rewrite `main.py` wholesale; change `interpret.py`;
log or return API keys; `git push`.

## Timebox

60 minutes.
