"""HTTP API. Contract: docs/ARCHITECTURE.md → "API contract"."""
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from collections import defaultdict, deque

from fastapi import Depends, FastAPI, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, interpret, office, office_api, office_db, operator_api, photo, photos, update, voice

Lang = Literal["it", "en", "es", "fr", "de"]
WEB_DIST = Path(__file__).parent.parent.parent / "web" / "dist"


@asynccontextmanager
async def lifespan(app):
    db.init()
    office_db.connect().close()  # create office tables

    def purger():
        while True:
            try:
                photos.purge_drafts()
            except Exception:
                logging.exception("draft purge failed")
            time.sleep(3600)

    threading.Thread(target=purger, daemon=True, name="draft-purge").start()
    if os.environ.get("UPDATE_DISABLED") != "1":
        def updater():
            time.sleep(60)
            while True:
                try:
                    update.run()
                except Exception:  # never let the daily thread die
                    logging.exception("daily update failed")
                time.sleep(24 * 3600)
        threading.Thread(target=updater, daemon=True, name="daily-update").start()
    yield


app = FastAPI(title="Oggetti smarriti Roma", lifespan=lifespan)
app.include_router(operator_api.router)
app.include_router(office_api.router)


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    code, _, message = str(exc.detail).partition(": ")
    return JSONResponse({"error": code, "message": message or code}, status_code=exc.status_code)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def meta():
    return db.meta()


@app.get("/api/items")
def items(
    q: str = "",
    category: str | None = None,
    brand: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return {**db.search(q.split(), category, brand, date_from, date_to, limit, offset), "interpreted": None}


# Voice, photo and (since D-014) text interpretation cost money per call: cap per client and per day.
PAID_PER_IP = int(os.environ.get("PAID_PER_IP", "20"))  # per 10 minutes
PAID_PER_DAY = int(os.environ.get("PAID_PER_DAY", "500"))
TEXT_PER_IP = int(os.environ.get("TEXT_PER_IP", "60"))  # per 10 minutes
_hits: dict[str, deque] = defaultdict(deque)
_text_hits: dict[str, deque] = defaultdict(deque)
_day = {"date": "", "n": 0}
_quota_lock = threading.Lock()


def _quota(request: Request, hits: dict, per_ip: int, per_day: int | None, message: str):
    # The app listens on 127.0.0.1 only, so requests arrive via Cloudflare, which sets this header.
    ip = request.headers.get("cf-connecting-ip") or request.client.host
    now, today = time.time(), time.strftime("%Y-%m-%d")
    with _quota_lock:
        if _day["date"] != today:
            _day.update(date=today, n=0)
        q = hits[ip]
        while q and now - q[0] > 600:
            q.popleft()
        if len(q) >= per_ip or (per_day is not None and _day["n"] >= per_day):
            raise HTTPException(429, message)
        q.append(now)
        if per_day is not None:
            _day["n"] += 1


def paid_quota(request: Request):
    _quota(request, _hits, PAID_PER_IP, PAID_PER_DAY,
           "rate_limited: too many voice/photo searches, type your query instead")


def text_quota(request: Request):
    _quota(request, _text_hits, TEXT_PER_IP, None, "rate_limited: too many searches, wait a minute")


@app.get("/api/items/{item_id}")
def one_item(item_id: str):
    if item_id.startswith("office-"):
        found = office.public_item(item_id)
    else:
        found = db.item(item_id)
    if found is None:
        raise HTTPException(404, "not_found: no such entry")
    return found


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    lang: Lang = "it"


@app.post("/api/search")
def search(req: SearchRequest, _=Depends(text_quota)):
    return interpret.search(req.query, req.lang)


@app.post("/api/search/voice")
def search_voice(audio: UploadFile, lang: Lang = Form("it"), _=Depends(paid_quota)):
    data = audio.file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "too_large: audio exceeds 10 MB")

    try:
        text = voice.transcribe(data, audio.filename, audio.content_type)
    except Exception:
        raise HTTPException(502, "upstream_failed: voice service unavailable, type your query instead") from None

    if not text:
        return {"items": [], "total": 0, "interpreted": None, "transcript": ""}

    return {**interpret.search(text, lang), "transcript": text}


@app.post("/api/search/photo")
async def search_photo(image: UploadFile, lang: Lang = Form("it"), _=Depends(paid_quota)):
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "bad_request: image must be jpeg, png or webp")

    data = await image.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "too_large: image exceeds 8 MB")

    try:
        text = await photo.describe(data, image.content_type)
    except Exception:
        raise HTTPException(502, "upstream_failed: photo service unavailable, type your query instead") from None

    if text is None or not text.strip():
        return {"items": [], "total": 0, "interpreted": None, "description": None}

    return {**interpret.search(text, lang), "description": text}


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True))
