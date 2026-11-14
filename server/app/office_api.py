"""Public office endpoints: photos, slots, booking, manage link (spec §2 "Public endpoints")."""
from datetime import date as Date
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import booking, photos, ratelimit

router = APIRouter()


@router.get("/api/photos/{name}")
def photo_file(name: str):
    p = photos.file(name)
    if p is None:
        raise HTTPException(404, "not_found: no such photo")
    return FileResponse(p, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})


def _date(value: str) -> Date:
    try:
        return Date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, "bad_request: date must be yyyy-mm-dd") from None


@router.get("/api/office/slots")
def office_slots(date: str):  # query name is part of the contract
    d = _date(date)
    return {"date": d.isoformat(), "slots": booking.slots(d)}


class BookRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    contact: str = Field(min_length=3, max_length=120)
    slot_start: str = Field(max_length=16)
    ack: Literal[True]


@router.post("/api/office/items/{item_id}/book")
def book_item(item_id: str, req: BookRequest, request: Request):
    if not ratelimit.BOOKING.hit(ratelimit.client_ip(request)):
        raise HTTPException(429, "rate_limited: too many bookings, try again later")
    return booking.book(item_id, req.name, req.contact, req.slot_start)


@router.get("/api/bookings/{token}")
def get_booking(token: str):
    found = booking.by_token(token)
    if found is None:
        raise HTTPException(404, "not_found: booking not found")
    return found


@router.delete("/api/bookings/{token}")
def cancel_booking(token: str):
    return booking.cancel_by_token(token)
