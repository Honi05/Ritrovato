from fastapi.testclient import TestClient

from app import auth, office_db
from app.main import app


def client():
    return TestClient(app)


def login(c, username="ana", password="correct horse"):
    return c.post("/api/operator/login", json={"username": username, "password": password})


def test_login_me_logout():
    auth.create_operator("ana", "correct horse", "Ana")
    c = client()
    r = login(c)
    assert r.status_code == 200 and r.json() == {"username": "ana", "display_name": "Ana", "is_admin": False}
    cookie = r.headers["set-cookie"].lower()
    assert "rt_op=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert c.get("/api/operator/me").json()["username"] == "ana"
    assert c.post("/api/operator/logout").status_code == 200
    r = c.get("/api/operator/me")
    assert r.status_code == 401 and r.json()["error"] == "unauthorized"


def test_wrong_password_and_unknown_user_look_the_same():
    auth.create_operator("ana", "correct horse")
    a, b = login(client(), password="nope"), login(client(), username="ghost")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_password_is_hashed():
    auth.create_operator("ana", "correct horse")
    with office_db.connect() as con:
        h = con.execute("select password_hash from operators").fetchone()[0]
    assert h.startswith("$argon2") and "correct horse" not in h


def test_login_rate_limited():
    auth.create_operator("ana", "correct horse")
    c = client()
    codes = [login(c, password="bad").status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_expired_session_is_401():
    auth.create_operator("ana", "correct horse")
    c = client()
    login(c)
    with office_db.connect() as con:
        con.execute("update sessions set expires_at = '2000-01-01T00:00:00+00:00'")
    assert c.get("/api/operator/me").status_code == 401


def test_secure_cookie_behind_https():
    auth.create_operator("ana", "correct horse")
    r = client().post("/api/operator/login", json={"username": "ana", "password": "correct horse"},
                      headers={"x-forwarded-proto": "https"})
    assert "secure" in r.headers["set-cookie"].lower()


def test_duplicate_username_rejected():
    auth.create_operator("ana", "correct horse")
    import pytest
    with pytest.raises(ValueError):
        auth.create_operator("ana", "other password")
