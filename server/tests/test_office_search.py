import pytest
from fastapi.testclient import TestClient

from app import auth, interpret, office
from app.main import app


@pytest.fixture(autouse=True)
def operator():
    auth.create_operator("ana", "correct horse")  # office_items.created_by is a FK to operators(id)


def add(category="wallet", colour="black", descr="Portafoglio in pelle", place="Termini", found_at="2026-11-10",
        brand=None):
    return office.create({"category": category, "colour": colour, "descr": descr, "found_place": place,
                          "found_at": found_at, "brand": brand}, 1)["id"]


def fake(monkeypatch, **f):
    base = {"category": None, "brand": None, "keywords": [], "date_from": None, "date_to": None,
            "ignored": [], "colour": None, "place": None}
    monkeypatch.setattr(interpret, "interpret", lambda text, lang: {**base, **f})


def search(q="x"):
    return TestClient(app).post("/api/search", json={"query": q, "lang": "en"}).json()


def test_registry_items_have_origin():
    it = TestClient(app).get("/api/items", params={"limit": 1}).json()["items"][0]
    assert it["origin"] == "registry" and it["photo_url"] is None and it["colour"] is None


def test_office_list_and_registry_unchanged(monkeypatch):
    fake(monkeypatch, category="wallet")
    before = search("wallet a")
    add()
    after = search("wallet b")
    assert before["office"] == [] and len(after["office"]) == 1
    assert after["total"] == before["total"]
    assert [i["id"] for i in after["items"]] == [i["id"] for i in before["items"]]


def test_colour_and_place_rank(monkeypatch):
    red = add(colour="red", place="Colosseo")
    black = add(colour="black", place="Colosseo")
    black_termini = add(colour="black", place="Stazione Termini")
    fake(monkeypatch, category="wallet", colour="black", place="Termini")
    ids = [i["id"] for i in search()["office"]]
    assert ids == [black_termini, black, red]


def test_hard_filters_and_relaxation(monkeypatch):
    add(category="keys", descr="Mazzo di chiavi")
    fake(monkeypatch, category="wallet")
    assert search()["office"] == []  # category is never relaxed
    w = add(found_at="2026-01-05")
    fake(monkeypatch, category="wallet", keywords=["GUCCI"], date_from="2026-10-01", date_to="2026-10-31")
    assert [i["id"] for i in search()["office"]] == [w]  # keywords then dates dropped


def test_reserved_last_and_hidden_statuses(monkeypatch):
    a, b = add(descr="Portafoglio A"), add(descr="Portafoglio B")
    from app import office_db
    with office_db.connect() as con:
        con.execute("UPDATE office_items SET status='reserved' WHERE id=?", (office.parse_id(b),))
    c = add(descr="Portafoglio C")
    with office_db.connect() as con:
        con.execute("UPDATE office_items SET status='discarded' WHERE id=?", (office.parse_id(c),))
    fake(monkeypatch, category="wallet")
    ids = [i["id"] for i in search()["office"]]
    assert ids == [a, b]


def test_limit_six(monkeypatch):
    for i in range(8):
        add(descr=f"Portafoglio {i}")
    fake(monkeypatch, category="wallet")
    assert len(search()["office"]) == 6


def test_catalogue_browse(monkeypatch):
    w = add()
    add(category="keys", descr="Chiavi")
    c = TestClient(app)
    r = c.get("/api/items", params={"source": "office", "category": "wallet"}).json()
    assert r["total"] == 1 and r["items"][0]["id"] == w and r["office"] == []
    r = c.get("/api/items", params={"category": "wallet"}).json()
    assert [i["id"] for i in r["office"]] == [w] and r["items"][0]["origin"] == "registry"
    assert c.get("/api/items", params={"category": "wallet", "offset": 20}).json()["office"] == []


def test_interpret_normalises_colour_and_place(monkeypatch):
    monkeypatch.setattr(interpret, "_request_filter_agent", lambda t, l: None)
    monkeypatch.setattr(interpret, "_request_filter", lambda t, l: {
        "category": "wallet", "colour": "Black", "place": "  Termini  ", "keywords": [], "ignored": []})
    f = interpret.interpret("black wallet at Termini", "en")
    assert f["colour"] == "black" and f["place"] == "Termini"
    monkeypatch.setattr(interpret, "_request_filter", lambda t, l: {"category": "wallet", "colour": "teal"})
    f = interpret.interpret("teal wallet", "en")
    assert f["colour"] is None and f["place"] is None


def test_fallback_has_new_keys():
    f = interpret.fallback_interpret("portafoglio")
    assert f["colour"] is None and f["place"] is None
