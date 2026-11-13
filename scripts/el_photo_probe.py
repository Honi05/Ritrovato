"""Probe: ElevenLabs agent describes a photo. Usage: probe.py <signed_wss_url> [image]"""
import asyncio, json, sys, time, urllib.parse, urllib.request
from pathlib import Path

import httpx, websockets

HERE = Path(__file__).parent


def get_image() -> Path:
    img = HERE / "keys.jpg"
    if img.exists():
        return img
    q = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search"
         "&gsrsearch=keyring+keys+photograph+filetype:bitmap&gsrnamespace=6&gsrlimit=3"
         "&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json")
    h = {"User-Agent": "probe/1.0"}
    pages = httpx.get(q, headers=h, timeout=20).json()["query"]["pages"]
    page = next(iter(pages.values()))
    print("image:", page["title"])
    img.write_bytes(httpx.get(page["imageinfo"][0]["thumburl"], headers=h, timeout=30).content)
    return img


async def main(url: str, img: Path):
    conv_id = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["conversation_id"][0]
    t0 = time.monotonic()
    async with websockets.connect(url, max_size=None) as ws:
        await ws.send(json.dumps({"type": "conversation_initiation_client_data"}))
        print(f"ws open {time.monotonic()-t0:.1f}s")
        up = httpx.post(f"https://api.elevenlabs.io/v1/convai/conversations/{conv_id}/files",
                        files={"file": (img.name, img.read_bytes(), "image/jpeg")}, timeout=30)
        print("upload", up.status_code, up.text[:200])
        file_id = up.json()["file_id"]
        t1 = time.monotonic()
        await ws.send(json.dumps({
            "type": "multimodal_message",
            "text": {"type": "user_message", "text": "Descrivi l'oggetto nella foto.", "source_medium": "image"},
            "files": [{"type": "file_input", "file_id": file_id}],
        }))
        async for raw in ws:
            m = json.loads(raw)
            t = m.get("type")
            if t == "ping":
                await ws.send(json.dumps({"type": "pong", "event_id": m["ping_event"]["event_id"]}))
            elif t == "agent_response":
                print("ANSWER:", m["agent_response_event"]["agent_response"])
                print(f"time: total {time.monotonic()-t0:.1f}s, after upload {time.monotonic()-t1:.1f}s")
                return
            elif t not in ("agent_chat_response_part", "conversation_initiation_metadata"):
                print("event:", str(m)[:200])


if sys.argv[1] == "key":  # fresh signed URL via API key
    k = (Path.home() / ".config/elevenlabs/key").read_text().strip()
    sys.argv[1] = httpx.get("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
        params={"agent_id": "agent_1001m7b5fdv5ese97f0hxxjgd9x5", "include_conversation_id": "true"},
        headers={"xi-api-key": k}, timeout=20).json()["signed_url"]
asyncio.run(main(sys.argv[1], Path(sys.argv[2]) if len(sys.argv) > 2 else get_image()))
