"""Operator admin CLI.

    python -m app.operators create-admin <username>      # prompts for the password
    python -m app.operators seed-demo --password <pw>    # operator "demo" + sample office items
    python -m app.operators refresh-demo-photos          # swap old placeholders for seed/demo_photos/
"""
import argparse
import getpass
import io
import sys
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw

from . import auth, office, office_db, photos

SWATCH = {"black": (34, 34, 34), "brown": (120, 72, 40), "blue": (40, 80, 160), "red": (180, 40, 40),
          "silver": (190, 190, 195), "pink": (230, 140, 170), "green": (50, 120, 70), "beige": (215, 195, 160)}

DEMO_ITEMS = [
    ("wallet", None, "black", "Portafoglio in pelle nero con tessera ATAC", "Termini, binario 4", 1),
    ("phone", "SAMSUNG", "blue", "Smartphone Samsung con cover blu", "Metro A, Spagna", 2),
    ("keys", None, "silver", "Mazzo di tre chiavi con portachiavi Colosseo", "Bus 64, Largo Argentina", 2),
    ("bag", None, "brown", "Zaino marrone con libri universitari", "Piazza Navona", 3),
    ("glasses", "RAY-BAN", "black", "Occhiali da sole Ray-Ban in custodia", "Fontana di Trevi", 4),
    ("clothing", None, "red", "Sciarpa di lana rossa", "Musei Vaticani, ingresso", 5),
    ("electronics", "APPLE", "silver", "Auricolari AirPods con custodia", "Tram 8, Trastevere", 6),
    ("watch_jewelry", None, "pink", "Braccialetto di perline rosa e nere", "Villa Borghese", 7),
]
# Real, openly licensed photos per demo category; credits in seed/demo_photos/CREDITS.md.
DEMO_PHOTOS = Path(__file__).resolve().parent.parent / "seed" / "demo_photos"


def _placeholder(colour: str, label: str) -> bytes:
    img = Image.new("RGB", (900, 900), SWATCH.get(colour, (120, 120, 120)))
    d = ImageDraw.Draw(img)
    d.rectangle((60, 60, 840, 840), outline=(255, 255, 255), width=12)
    d.text((100, 420), label.upper(), fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def _demo_photo(category: str, colour: str) -> bytes:
    f = DEMO_PHOTOS / f"{category}.jpg"
    return f.read_bytes() if f.is_file() else _placeholder(colour, category)


def seed_demo(password: str) -> int:
    try:
        auth.create_operator("demo", password, "Demo operator")
    except ValueError:
        auth.set_password("demo", password)
    with office_db.connect() as con:
        if con.execute("SELECT count(*) FROM office_items").fetchone()[0]:
            return 0
        op_id = con.execute("SELECT id FROM operators WHERE username = 'demo'").fetchone()[0]
    for category, brand, colour, descr, place, days_ago in DEMO_ITEMS:
        draft_id = photos.save_draft(_demo_photo(category, colour), "image/jpeg")
        office.create({"draft_id": draft_id, "category": category, "brand": brand, "colour": colour,
                       "descr": descr, "found_place": place,
                       "found_at": (date.today() - timedelta(days=days_ago)).isoformat()}, op_id)
    return len(DEMO_ITEMS)


def refresh_demo_photos() -> int:
    """Give already-seeded demo items (matched by category and place) the real photo and current text."""
    n = 0
    for category, _brand, colour, descr, place, _days in DEMO_ITEMS:
        with office_db.connect() as con:
            ids = [r[0] for r in con.execute(
                "SELECT id FROM office_items WHERE category = ? AND found_place = ?", (category, place))]
        for item_id in ids:
            draft_id = photos.save_draft(_demo_photo(category, colour), "image/jpeg")
            office.update(item_id, {"draft_id": draft_id, "descr": descr})
            n += 1
    return n


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m app.operators")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("create-admin")
    a.add_argument("username")
    a.add_argument("--display-name")
    s = sub.add_parser("seed-demo")
    s.add_argument("--password", required=True)
    sub.add_parser("refresh-demo-photos")
    args = p.parse_args(argv)
    if args.cmd == "create-admin":
        pw = getpass.getpass("Password: ")
        if pw != getpass.getpass("Repeat: "):
            sys.exit("passwords differ")
        try:
            auth.create_operator(args.username, pw, args.display_name, is_admin=True)
        except ValueError as e:
            sys.exit(str(e))
        print(f"created admin {args.username}")
    elif args.cmd == "refresh-demo-photos":
        print(f"refreshed photos of {refresh_demo_photos()} demo items")
    else:
        print(f"seeded {seed_demo(args.password)} office items; operator 'demo' ready")


if __name__ == "__main__":
    main()
