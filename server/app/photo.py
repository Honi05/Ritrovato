"""Photo -> Italian description via ElevenLabs Agent (block 05)."""
import asyncio
import json
import os
import urllib.parse

import httpx
import websockets

BASE_URL = "https://api.elevenlabs.io/v1"
DEFAULT_AGENT_ID = "agent_1001m7b5fdv5ese97f0hxxjgd9x5"
TIMEOUT = 20.0
_NESSUN_OGGETTO = "NESSUN OGGETTO"


def _filename_for(content_type: str) -> str:
    if content_type == "image/png":
        return "image.png"
    if content_type == "image/webp":
        return "image.webp"
    return "image.jpg"


async def _describe(data: bytes, content_type: str) -> str | None:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    agent_id = os.environ.get("ELEVENLABS_PHOTO_AGENT_ID", DEFAULT_AGENT_ID)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        signed = await client.get(
            f"{BASE_URL}/convai/conversation/get-signed-url",
            params={"agent_id": agent_id, "include_conversation_id": "true"},
            headers={"xi-api-key": key},
        )
        signed.raise_for_status()
        signed_url = signed.json()["signed_url"]
        conversation_id = urllib.parse.parse_qs(
            urllib.parse.urlparse(signed_url).query
        )["conversation_id"][0]

        async with websockets.connect(signed_url, max_size=None) as ws:
            await ws.send(json.dumps({"type": "conversation_initiation_client_data"}))

            upload = await client.post(
                f"{BASE_URL}/convai/conversations/{conversation_id}/files",
                files={"file": (_filename_for(content_type), data, content_type or "image/jpeg")},
            )
            upload.raise_for_status()
            file_id = upload.json()["file_id"]

            await ws.send(json.dumps({
                "type": "multimodal_message",
                "text": {
                    "type": "user_message",
                    "text": "Descrivi l'oggetto nella foto.",
                    "source_medium": "image",
                },
                "files": [{"type": "file_input", "file_id": file_id}],
            }))

            async for raw in ws:
                message = json.loads(raw)
                mtype = message.get("type")
                if mtype == "ping":
                    await ws.send(json.dumps({
                        "type": "pong",
                        "event_id": message["ping_event"]["event_id"],
                    }))
                elif mtype == "agent_response":
                    answer = message["agent_response_event"]["agent_response"]
                    if not isinstance(answer, str):
                        return None
                    return None if answer.strip().upper() == _NESSUN_OGGETTO else answer

    return None


async def describe(data: bytes, content_type: str) -> str | None:
    """Describe the photo in Italian, or return None when nothing is visible."""
    try:
        return await asyncio.wait_for(_describe(data, content_type), timeout=TIMEOUT)
    except Exception as exc:
        raise RuntimeError("ElevenLabs photo description failed") from exc
