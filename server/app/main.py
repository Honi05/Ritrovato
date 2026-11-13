"""HTTP API. Contract: docs/ARCHITECTURE.md → "API contract"."""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, interpret, photo, voice

Lang = Literal["it", "en", "es", "fr", "de"]
WEB_DIST = Path(__file__).parent.parent.parent / "web" / "dist"


@asynccontextmanager
async def lifespan(app):
    db.init()
    yield


app = FastAPI(title="Oggetti smarriti Roma", lifespan=lifespan)


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


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    lang: Lang = "it"


@app.post("/api/search")
def search(req: SearchRequest):
    return interpret.search(req.query, req.lang)


@app.post("/api/search/voice")
def search_voice(audio: UploadFile, lang: Lang = Form("it")):
    data = audio.file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "too_large: audio exceeds 10 MB")

    try:
        text = voice.transcribe(data, audio.filename, audio.content_type)
    except Exception:
        raise HTTPException(502, "upstream_failed: voice transcription failed") from None

    if not text:
        return {"items": [], "total": 0, "interpreted": None, "transcript": ""}

    return {**interpret.search(text, lang), "transcript": text}


@app.post("/api/search/photo")
async def search_photo(image: UploadFile, lang: Lang = Form("it")):
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "bad_request: image must be jpeg, png or webp")

    data = await image.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "too_large: image exceeds 8 MB")

    try:
        text = await photo.describe(data, image.content_type)
    except Exception:
        raise HTTPException(502, "upstream_failed: photo description failed") from None

    if text is None or not text.strip():
        return {"items": [], "total": 0, "interpreted": None, "description": None}

    return {**interpret.search(text, lang), "description": text}


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True))
