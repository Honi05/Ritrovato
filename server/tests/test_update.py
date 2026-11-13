import os
import shutil
import sqlite3
from pathlib import Path

import pytest

from app import db, update
from ingest.parse import parse_page

REPO_ROOT = Path(__file__).resolve().parents[2]
TESSERACT = shutil.which(os.environ.get("TESSERACT_CMD", "tesseract"))


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.sqlite"
    con = sqlite3.connect(db_path)
    con.execute(
        """CREATE TABLE oggetti(year INT, reperto INT, date TEXT, descr TEXT,
        num_guessed INT, page INT, category TEXT, tags TEXT, brand TEXT,
        PRIMARY KEY(year, reperto, page))"""
    )
    con.execute("CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT)")
    con.commit()
    con.close()
    monkeypatch.setattr(update.db, "DB_PATH", db_path)
    return db_path


def test_find_pdf_url(monkeypatch):
    monkeypatch.setattr(update, "_current_year", lambda: 2026)
    html = """
    <a href="https://www.comune.roma.it/web-resources/cms/documents/Rinvenimenti_01012025_31122025.pdf">2025</a>
    <a href="https://www.comune.roma.it/web-resources/cms/documents/Rinvenimenti_01012026_11112026.pdf">2026</a>
    """
    assert update.find_pdf_url(html) == (
        "https://www.comune.roma.it/web-resources/cms/documents/Rinvenimenti_01012026_11112026.pdf",
        "11112026",
    )


def test_unchanged_pdf_only_touches_last_checked(tmp_db, monkeypatch):
    monkeypatch.setattr(update, "_current_year", lambda: 2026)
    monkeypatch.setattr(update, "_iso_utc", lambda: "2026-11-14T10:00:00+00:00")

    with db.connect() as con:
        con.execute(
            "INSERT INTO meta(key, value) VALUES('source_pdf', ?)",
            ("Rinvenimenti_01012026_11112026.pdf",),
        )

    html = (
        '<a href="https://www.comune.roma.it/web-resources/cms/documents/'
        'Rinvenimenti_01012026_11112026.pdf">lista</a>'
    )

    class Response:
        text = html

        def raise_for_status(self):
            pass

    monkeypatch.setattr(update.httpx, "get", lambda *a, **k: Response())

    def fail(*a, **k):
        raise AssertionError("network download or OCR should not be used")

    monkeypatch.setattr(update.httpx, "stream", fail)
    monkeypatch.setattr(update, "ocr_page", fail)

    result = update.run()
    assert result["status"] == "unchanged"

    with sqlite3.connect(tmp_db) as con:
        kv = dict(con.execute("SELECT key, value FROM meta").fetchall())
        assert kv["source_pdf"] == "Rinvenimenti_01012026_11112026.pdf"
        assert kv["last_checked_at"] == "2026-11-14T10:00:00+00:00"
        assert kv["new_items_last_check"] == "0"
        assert con.execute("SELECT count(*) FROM oggetti").fetchone()[0] == 0


def test_tsv_grouping_and_coordinate_conversion():
    tsv_text = (
        "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
        "5\t1\t1\t1\t1\t1\t0\t10\t100\t20\t90\tHELLO\n"
        "5\t1\t1\t1\t1\t2\t100\t10\t50\t20\t90\tWORLD\n"
    )
    lines = update._group_tsv(tsv_text, 200, 100)
    assert len(lines) == 1
    x, y, text = lines[0]
    assert x == pytest.approx(0.0)
    assert y == pytest.approx(0.7)
    assert text == "HELLO WORLD"


@pytest.mark.skipif(TESSERACT is None, reason="tesseract not installed")
def test_ocr_page_498_matches_stored_rows():
    pdf = REPO_ROOT / "data" / "oggetti" / "Rinvenimenti_01012026_04112026.pdf"
    if not pdf.exists():
        pytest.skip("source PDF not available")

    lines = update.ocr_page(str(pdf), 498)

    with db.connect() as con:
        prev_row = con.execute(
            "SELECT max(reperto) FROM oggetti WHERE year=2026 AND page<?", (498,)
        ).fetchone()
        prev = prev_row[0] if prev_row and prev_row[0] is not None else 0
        expected_rows = con.execute(
            "SELECT reperto, date FROM oggetti WHERE year=2026 AND page=498"
        ).fetchall()

    if not expected_rows:
        pytest.skip("no stored rows for page 498")

    expected = {(row["reperto"], row["date"]) for row in expected_rows}
    recs, _ = parse_page(lines, 2026, 498, prev)
    actual = {(r[0], r[1]) for r in recs}

    overlap = len(actual & expected)
    print("missing:", expected - actual)
    print("extra:", actual - expected)
    assert overlap / len(expected) >= 0.90, f"OCR page 498 overlap {overlap}/{len(expected)}"
