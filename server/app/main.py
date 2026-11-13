"""HTTP API. Contract: docs/ARCHITECTURE.md → "API contract"."""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db

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
    # Block 02 replaces this keyword fallback with LLM interpretation; keep the fallback for LLM failures.
    return {**db.search(req.query.split()), "interpreted": None}


@app.post("/api/search/voice")
def search_voice(audio: UploadFile, lang: Lang = Form("it")):
    raise HTTPException(501, "not_implemented: voice search arrives in block 04")


@app.post("/api/search/photo")
def search_photo(image: UploadFile, lang: Lang = Form("it")):
    raise HTTPException(501, "not_implemented: photo search arrives in block 05")


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True))
