"""Public office endpoints: photos, slots, booking, manage link (spec §2 "Public endpoints")."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from . import photos

router = APIRouter()


@router.get("/api/photos/{name}")
def photo_file(name: str):
    p = photos.file(name)
    if p is None:
        raise HTTPException(404, "not_found: no such photo")
    return FileResponse(p, media_type="image/webp", headers={"Cache-Control": "public, max-age=86400"})
