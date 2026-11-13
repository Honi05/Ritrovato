"""Daily registry update: check source page, OCR only new pages, insert new rows."""
import argparse
import functools
import json
import logging
import os
import re
import shlex
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import fitz
import httpx

from . import db
from ingest.parse import classify, parse_page

log = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
PDF_NAME_RE = re.compile(r"Rinvenimenti_0101(\d{4})_(\d{8})\.pdf")
TESSERACT_CMD = shlex.split(os.environ.get("TESSERACT_CMD", "tesseract"))


def _now():
    return datetime.now(timezone.utc)


def _current_year():
    return _now().year


def _iso_utc():
    return _now().isoformat(timespec="seconds")


def find_pdf_url(html):
    """Return (absolute_pdf_url, end_date_DDMMYYYY) for the current-year file, or None."""
    current_year = _current_year()
    for match in PDF_NAME_RE.finditer(html):
        year = int(match.group(1))
        if year != current_year:
            continue
        url = match.group(0)
        href_start = max(html.rfind('href="', 0, match.start()),
                         html.rfind("href='", 0, match.start()))
        if href_start != -1:
            quote = '"' if html[href_start + 5] == '"' else "'"
            href_end = html.find(quote, href_start + 6)
            if href_end != -1:
                url = html[href_start + 6:href_end]
        return urljoin(db.SOURCE_URL, url), match.group(2)
    return None, None


def _ensure_meta(con):
    con.execute("CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)")


def _get_meta(con, key):
    _ensure_meta(con)
    row = con.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return row[0] if row else None


def _set_meta(con, key, value):
    _ensure_meta(con)
    con.execute("INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)", (key, str(value)))


def _record_last_checked(con, new_items):
    _set_meta(con, "last_checked_at", _iso_utc())
    _set_meta(con, "new_items_last_check", new_items)


def _download(url, dest):
    with httpx.stream("GET", url, headers={"User-Agent": USER_AGENT},
                      timeout=30, follow_redirects=True) as response:
        response.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in response.iter_bytes():
                fh.write(chunk)


@functools.lru_cache(maxsize=None)
def _tesseract_lang():
    try:
        proc = subprocess.run([*TESSERACT_CMD, "--list-langs"],
                              capture_output=True, text=True, timeout=30)
        if proc.returncode == 0 and any(line.strip() == "ita" for line in proc.stdout.splitlines()):
            return "ita"
    except Exception:
        log.warning("could not list tesseract languages; using eng")
    return "eng"


def _group_tsv(tsv_text, width, height):
    """Group Tesseract TSV word rows into lines and convert to Vision coordinates."""
    rows = tsv_text.splitlines()
    if len(rows) < 2:
        return []
    header = rows[0].rstrip("\n").split("\t")
    idx = {name: i for i, name in enumerate(header)}
    groups = {}

    for raw in rows[1:]:
        parts = raw.rstrip("\n").split("\t")
        if len(parts) < len(header):
            continue
        try:
            level = parts[idx["level"]]
        except KeyError:
            continue
        if level != "5":
            continue
        text = parts[idx["text"]].strip()
        if not text:
            continue

        key = (parts[idx["block_num"]], parts[idx["par_num"]], parts[idx["line_num"]])
        left = float(parts[idx["left"]])
        top = float(parts[idx["top"]])
        w = float(parts[idx["width"]])
        h = float(parts[idx["height"]])

        groups.setdefault(key, []).append((left, top, left + w, top + h, text))

    # Split each line on wide horizontal gaps so table columns become separate items,
    # like macOS Vision's output that parse.py expects (number | description | date).
    gap = 0.02 * width
    out = []
    for words in groups.values():
        words.sort()
        segs = [[words[0]]]
        for wd in words[1:]:
            if wd[0] - segs[-1][-1][2] > gap:
                segs.append([wd])
            else:
                segs[-1].append(wd)
        for seg in segs:
            left = seg[0][0]
            bottom = max(wd[3] for wd in seg)
            out.append((left / width, 1 - bottom / height, " ".join(wd[4] for wd in seg)))
    return out


def fix_sequence(recs, prev):
    """Registry numbers are consecutive; replace OCR digit misreads (4771 -> 4111) by prev+1."""
    out = []
    for rec in recs:
        n = rec[1]
        if prev and abs(n - (prev + 1)) > 5:
            rec = (rec[0], prev + 1, *rec[2:])
        prev = rec[1]
        out.append(rec)
    return out, prev


def ocr_page(pdf_path, page_no):
    """OCR a 1-based PDF page with Tesseract and return `(x, y, text)` lines."""
    doc = fitz.open(pdf_path)
    try:
        page = doc.load_page(page_no - 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(300 / 72, 300 / 72), alpha=False)
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)
            image_path = tmp / "page.png"
            pix.save(str(image_path))

            out_base = tmp / "ocr"
            lang = _tesseract_lang()
            cmd = [*TESSERACT_CMD, str(image_path), str(out_base),
                   "--psm", os.environ.get("TESSERACT_PSM", "11"), "-l", lang, "tsv"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            if proc.returncode != 0:
                raise RuntimeError(f"tesseract failed: {proc.stderr.strip()[:300]}")

            tsv_path = Path(str(out_base) + ".tsv")
            if not tsv_path.exists():
                raise RuntimeError("tesseract did not write TSV")

            return _group_tsv(tsv_path.read_text(encoding="utf-8"), pix.width, pix.height)
    finally:
        doc.close()


def run(force=False, pages=None):
    """Check source page and update the registry. Never raises; returns a result dict."""
    result = {"status": "unknown"}
    try:
        html_response = httpx.get(db.SOURCE_URL, headers={"User-Agent": USER_AGENT},
                                  timeout=30, follow_redirects=True)
        html_response.raise_for_status()
        pdf_url, end_date = find_pdf_url(html_response.text)

        if not pdf_url:
            with db.connect() as con:
                _record_last_checked(con, 0)
            result.update({"status": "no_pdf", "new_items_last_check": 0,
                           "last_checked_at": _iso_utc()})
            return result

        pdf_name = Path(unquote(urlparse(pdf_url).path)).name

        with db.connect() as con:
            source_pdf = _get_meta(con, "source_pdf")

        if not force and pdf_name == source_pdf:
            with db.connect() as con:
                _record_last_checked(con, 0)
            result.update({
                "status": "unchanged",
                "source_pdf": pdf_name,
                "new_items_last_check": 0,
                "last_checked_at": _iso_utc(),
            })
            return result

        match = PDF_NAME_RE.search(pdf_name)
        if not match:
            raise RuntimeError(f"bad PDF filename {pdf_name}")
        year = int(match.group(1))

        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "new.pdf"
            _download(pdf_url, pdf_path)

            doc = fitz.open(pdf_path)
            try:
                total_pages = doc.page_count
                with db.connect() as con:
                    _ensure_meta(con)
                    row = con.execute("SELECT max(page) FROM oggetti WHERE year=?", (year,)).fetchone()
                    last_page = row[0]

                    if last_page:
                        prev_row = con.execute(
                            "SELECT max(reperto) FROM oggetti WHERE year=? AND page<?",
                            (year, last_page),
                        ).fetchone()
                        prev_reperto = prev_row[0] if prev_row and prev_row[0] is not None else 0
                    else:
                        prev_reperto = 0

                    start = last_page or 1
                    end = total_pages
                    if pages is not None:
                        end = min(end, start + pages - 1)
                    if end < start:
                        end = start - 1

                    new_rows = []
                    prev = prev_reperto
                    for pno in range(start, end + 1):
                        lines = ocr_page(str(pdf_path), pno)
                        recs, _ = parse_page(lines, year, pno, prev)
                        recs, prev = fix_sequence(recs, prev)
                        for rec in recs:
                            new_rows.append(rec + classify(rec[3]))

                    before = con.execute("SELECT count(*) FROM oggetti").fetchone()[0]
                    con.executemany(
                        "INSERT OR IGNORE INTO oggetti VALUES(?,?,?,?,?,?,?,?,?)",
                        new_rows,
                    )
                    after = con.execute("SELECT count(*) FROM oggetti").fetchone()[0]
                    inserted = after - before

                    _set_meta(con, "source_pdf", pdf_name)
                    _record_last_checked(con, inserted)

                result.update({
                    "status": "updated",
                    "source_pdf": pdf_name,
                    "end_date": end_date,
                    "pages_ocr": max(0, end - start + 1),
                    "new_items_last_check": inserted,
                    "last_checked_at": _iso_utc(),
                })
            finally:
                doc.close()

        return result
    except Exception as exc:
        log.exception("daily update failed")
        try:
            with db.connect() as con:
                _record_last_checked(con, 0)
        except Exception:
            log.exception("could not record last_checked_at")
        result.update({"status": "error", "error": str(exc),
                       "last_checked_at": _iso_utc(), "new_items_last_check": 0})
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--pages", type=int, help="cap OCR work for tests")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    print(json.dumps(run(force=args.force, pages=args.pages), indent=2))


if __name__ == "__main__":
    main()
