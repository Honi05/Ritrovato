"""ElevenLabs Scribe speech-to-text for the voice search route (block 04)."""
import os

import httpx

SCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text"
MODEL_ID = "scribe_v2"
TIMEOUT = 30.0


def transcribe(data: bytes, filename: str, content_type: str) -> str:
    """Return the transcript for an audio recording.

    No language_code is sent: Scribe auto-detects the spoken language.
    """
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    response = httpx.post(
        SCRIBE_URL,
        headers={"xi-api-key": key},
        files={"file": (filename or "audio.webm", data, content_type or "audio/webm")},
        data={"model_id": MODEL_ID},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return (response.json().get("text") or "").strip()
