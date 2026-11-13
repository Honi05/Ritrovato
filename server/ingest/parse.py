"""Parse OCR dumps (data/oggetti/raw/ocr_YYYY.txt) into data/oggetti/oggetti.sqlite.

Each OCR line is "x y text". A record is anchored by its date line (x~0.74);
number (x<0.2) and description lines (0.2<=x<0.7) belong to the nearest date above them.
"""
import re, sqlite3, sys, pathlib

D = pathlib.Path(__file__).parent
DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
TOL = 0.015


def pages(path):
    cur = None
    for ln in path.read_text(encoding="utf-8").splitlines():
        if ln.startswith("=== page"):
            cur = int(ln.split()[2])
            yield cur, None
            continue
        m = re.match(r"^(\d\.\d+) (\d\.\d+) (.*)$", ln)
        if m:
            yield cur, (float(m[1]), float(m[2]), m[3].strip())


def parse(year):
    recs, by_page = [], {}
    for pg, item in pages(D / f"raw/ocr_{year}.txt"):
        by_page.setdefault(pg, [])
        if item:
            by_page[pg].append(item)
    prev = 0
    for pg in sorted(by_page):
        lines = by_page[pg]
        hdr = [y for x, y, t in lines if t.startswith("DATA ACQ")]
        top = hdr[0] if hdr else 0.8  # nothing above the table header is data
        body = [l for l in lines if l[1] < top - 0.005]
        dates = sorted([l for l in body if DATE.match(l[2]) and l[0] > 0.6], key=lambda l: -l[1])
        slots = [{"date": d[2], "y": d[1], "num": None, "desc": []} for d in dates]
        for x, y, t in sorted(body, key=lambda l: (-l[1], l[0])):
            if DATE.match(t) and x > 0.6:
                continue
            cand = [s for s in slots if s["y"] + TOL >= y]
            if not cand:
                continue
            s = min(cand, key=lambda s: s["y"] + TOL - y)
            if x < 0.2 and re.fullmatch(r"\d+", t):
                s["num"] = int(t)
            elif 0.2 <= x < 0.7:
                s["desc"].append(t)
        for s in slots:
            guessed = s["num"] is None
            n = s["num"] if not guessed else prev + 1
            prev = n
            desc = re.sub(r"\s+", " ", " ".join(s["desc"])).strip(" -")
            recs.append((year, n, s["date"], desc, int(guessed), pg))
    return recs


# (category, regex) — first match on the first segment = category; matches anywhere = tags.
CATS = [
    ("phone", r"TELEFONO|SMARTPHONE|CELLULARE"),
    ("sim", r"SIMCARD"),
    ("id_document", r"CARTA IDENTIT|PASSAPORTO|PERMESSO DI SOGGIORNO|PATENTE|TESSERA SANITARIA|TESSERA DI RICONOSC|CODICE FISCALE"),
    ("payment_card", r"CARTA DI CREDITO|BANCOMAT|CARTA PREPAGATA|POSTEPAY"),
    ("wallet", r"PORTAFOGLI|ORTAFOGLI|PORTATESSERE|PORTADOCUMENTI|PORTAMONETE|PORTACARTE"),
    ("keys", r"CHIAVI|PORTACHIAVI|TELECOMANDO"),
    ("bag", r"ZAINO|BORSA|BORSELLO|POCHETTE|MARSUPIO|TROLLEY|VALIGIA|BORSONE|SACCA"),
    ("glasses", r"OCCHIALE"),
    ("electronics", r"IPAD|PC PORTATILE|KINDLE|LETTORE|TABLET|COMPUTER|NOTEBOOK|LAPTOP|AURICOLAR|CUFFIE|CAMERA|FOTOCAMERA|CARICABATTERIE|POWER ?BANK|ELETTRONICA|ALTRO \(ELETTR|SMARTWATCH"),
    ("watch_jewelry", r"OROLOGIO|BIGIOTTERIA|ANELLO|COLLANA|BRACCIALE|GIOIELL|ORECCHINI"),
    ("money", r"DENARO|BANCONOT|MONETE"),
    ("clothing", r"INDUMENTI|ABBIGLIAMENTO|CAPPELLO|GIACCA|SCARPE|SCIARPA|GUANTI|OMBRELLO"),
    ("vehicle", r"BICICLETTA|MONOPATTINO|BICI\b|CASCO"),
    ("document_other", r"TESSERA|LIBRETTO|BUONO PASTO|CARTA DI CIRCOLAZIONE|AGENDA|BADGE|CARTE VARIE|CARTELLINA|BUSTA|LIBRO"),
]
BRANDED = {"phone", "electronics", "bag", "watch_jewelry", "glasses"}


def classify(descr):
    d = descr.upper()
    first = d.split(" - ")[0]
    cat = next((c for c, r in CATS if re.search(r, first)), "other")
    tags = sorted({c for c, r in CATS if re.search(r, d)} | {cat})
    brand = None
    segs = d.split(" - ")
    if cat in BRANDED and len(segs) > 1:
        s = segs[1].strip()
        if s and not re.search(r"\d|:|\*", s) and not any(re.search(r, s) for _, r in CATS):
            brand = re.sub(r"^APPLE\b.*", "APPLE", s)
            if re.match(r"N/D|ALTRO|EFFETTI|NON ", brand):
                brand = None
    return cat, ",".join(tags), brand


def main():
    db = D / "oggetti.sqlite"
    db.unlink(missing_ok=True)
    c = sqlite3.connect(db)
    c.execute("""CREATE TABLE oggetti(year INT, reperto INT, date TEXT, descr TEXT,
                 num_guessed INT, page INT, category TEXT, tags TEXT, brand TEXT, PRIMARY KEY(year, reperto, page))""")
    for y in (2025, 2026):
        r = parse(y)
        c.executemany("INSERT OR REPLACE INTO oggetti VALUES(?,?,?,?,?,?,?,?,?)",
                      [x + classify(x[3]) for x in r])
        nums = sorted({x[1] for x in r})
        miss = set(range(nums[0], nums[-1] + 1)) - set(nums)
        print(y, "records", len(r), "range", nums[0], nums[-1], "missing", len(miss),
              "guessed", sum(x[4] for x in r), "empty_desc", sum(1 for x in r if not x[3]))
    c.commit()


if __name__ == "__main__":
    main()
