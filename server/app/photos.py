"""Office photo uploads (spec §1 "Photos")."""
import os
from pathlib import Path

from . import office_db

DIR = Path(os.environ.get("PHOTOS_DIR", office_db.PATH.parent / "photos"))
