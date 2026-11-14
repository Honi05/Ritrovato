"""Office photo uploads (spec §1 "Photos"): re-encoded WebP, EXIF stripped, drafts expire."""
import io
import os
import re
import time
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from . import office_db

DIR = Path(os.environ.get("PHOTOS_DIR", office_db.PATH.parent / "photos"))
MAX_BYTES = 8 * 1024 * 1024
TYPES = {"image/jpeg", "image/png", "image/webp"}
LONGEST = 1200
NAME_RE = re.compile(r"^[0-9a-f]{32}\.webp$")
_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _drafts() -> Path:
    d = Path(DIR) / "drafts"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_draft(data: bytes, content_type: str | None) -> str:
    if content_type not in TYPES:
        raise HTTPException(400, "bad_request: image must be jpeg, png or webp")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "too_large: image exceeds 8 MB")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(400, "bad_request: not a readable image") from None
    img.thumbnail((LONGEST, LONGEST))
    draft_id = uuid.uuid4().hex
    img.save(_drafts() / f"{draft_id}.webp", "WEBP", quality=82)  # no exif= → metadata dropped
    return draft_id


def draft_path(draft_id: str) -> Path | None:
    if not _ID_RE.match(draft_id or ""):
        return None
    p = _drafts() / f"{draft_id}.webp"
    return p if p.exists() else None


def promote(draft_id: str) -> str:
    src = draft_path(draft_id)
    if src is None:
        raise HTTPException(400, "bad_request: unknown or expired photo, upload it again")
    name = f"{draft_id}.webp"
    src.replace(Path(DIR) / name)
    return name


def purge_drafts(max_age: float = 86400) -> int:
    cutoff, n = time.time() - max_age, 0
    for p in _drafts().glob("*.webp"):
        if p.stat().st_mtime < cutoff:
            p.unlink(missing_ok=True)
            n += 1
    return n


def url(name: str | None) -> str | None:
    return f"/api/photos/{name}" if name else None


def file(name: str) -> Path | None:
    if not NAME_RE.match(name):
        return None
    p = Path(DIR) / name
    return p if p.is_file() else None
