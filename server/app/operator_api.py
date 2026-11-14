"""Back-office API: /api/operator/* (spec §2). Every route except login needs a session."""
import asyncio
from datetime import date as Date
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import auth, booking, interpret, office, photo, photos, ratelimit

router = APIRouter(prefix="/api/operator")
Operator = Depends(auth.current_operator)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


@router.post("/login")
def login(req: LoginRequest, request: Request, response: Response):
    if not ratelimit.LOGIN.hit(ratelimit.client_ip(request)):
        raise HTTPException(429, "rate_limited: too many login attempts, wait 10 minutes")
    row = auth.verify(req.username, req.password)
    if row is None:
        raise HTTPException(401, "unauthorized: wrong username or password")
    token = auth.new_session(row["id"])
    response.set_cookie(auth.COOKIE, token, max_age=int(auth.TTL.total_seconds()), httponly=True,
                        samesite="lax", secure=auth.is_https(request), path="/")
    return auth.public(row)


@router.post("/logout")
def logout(request: Request, response: Response):
    auth.end_session(request.cookies.get(auth.COOKIE))
    response.delete_cookie(auth.COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(op: dict = Operator):
    return {k: op[k] for k in ("username", "display_name", "is_admin")}


AI_TIMEOUT = 14.0


@router.post("/items/draft")
async def draft(image: UploadFile = File(...), op: dict = Operator):
    data = await image.read(photos.MAX_BYTES + 1)
    draft_id = photos.save_draft(data, image.content_type)
    suggested = None
    try:
        text = await asyncio.wait_for(photo.describe(data, image.content_type), timeout=AI_TIMEOUT)
        if text and text.strip():
            f = await asyncio.to_thread(interpret.interpret, text, "it") or {}
            suggested = {"category": f.get("category"), "brand": f.get("brand"),
                         "colour": f.get("colour"), "descr": text.strip()}
    except Exception:  # AI pre-fill is optional; the operator fills the form by hand
        suggested = None
    return {"draft_id": draft_id, "photo_url": f"/api/operator/drafts/{draft_id}.webp", "suggested": suggested}


@router.get("/drafts/{name}")
def draft_file(name: str, op: dict = Operator):
    p = photos.draft_path(name.removesuffix(".webp"))
    if p is None:
        raise HTTPException(404, "not_found: no such draft")
    return FileResponse(p, media_type="image/webp")


class ItemIn(BaseModel):
    draft_id: str | None = None
    category: str
    brand: str | None = Field(None, max_length=40)
    colour: str | None = None
    descr: str = Field(min_length=3, max_length=500)
    found_place: str = Field(min_length=2, max_length=120)
    found_at: str


class ItemPatch(BaseModel):
    draft_id: str | None = None
    category: str | None = None
    brand: str | None = Field(None, max_length=40)
    colour: str | None = None
    descr: str | None = Field(None, min_length=3, max_length=500)
    found_place: str | None = Field(None, min_length=2, max_length=120)
    found_at: str | None = None
    status: Literal["returned", "discarded"] | None = None


@router.post("/items")
def create_item(req: ItemIn, op: dict = Operator):
    return office.create(req.model_dump(), op["id"])


@router.patch("/items/{item_id}")
def patch_item(item_id: int, req: ItemPatch, op: dict = Operator):
    return office.update(item_id, req.model_dump(exclude_unset=True))


@router.get("/items")
def list_items(
    status: Literal["available", "reserved", "returned", "discarded"] | None = None,
    category: str | None = None,
    q: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    op: dict = Operator,
):
    return office.list_items(status, category, q, limit, offset)


@router.get("/bookings")
def day_bookings(date: str, op: dict = Operator):  # query name is part of the contract
    try:
        d = Date.fromisoformat(date)
    except ValueError:
        raise HTTPException(400, "bad_request: date must be yyyy-mm-dd") from None
    return booking.day(d)


class BookingPatch(BaseModel):
    status: Literal["collected", "no_show", "cancelled"]


@router.patch("/bookings/{booking_id}")
def patch_booking(booking_id: int, req: BookingPatch, op: dict = Operator):
    return booking.set_status(booking_id, req.status)
