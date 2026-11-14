"""Operator accounts and cookie sessions (spec §2 "Operator endpoints")."""
import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException, Request, Response

from . import office_db

COOKIE = "rt_op"
TTL = timedelta(hours=12)
_ph = PasswordHasher()
_DUMMY = _ph.hash("timing-equaliser")  # unknown users cost the same as wrong passwords


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _expiry() -> str:
    return (datetime.now(timezone.utc) + TTL).isoformat(timespec="seconds")


def create_operator(username: str, password: str, display_name: str | None = None, is_admin: bool = False) -> int:
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    try:
        with office_db.connect() as con:
            cur = con.execute(
                "INSERT INTO operators (username, password_hash, display_name, is_admin, created_at) VALUES (?,?,?,?,?)",
                (username, _ph.hash(password), display_name or username, int(is_admin), office_db.now()),
            )
            return cur.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError(f"operator {username!r} already exists") from None


def set_password(username: str, password: str) -> None:
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    with office_db.connect() as con:
        con.execute("UPDATE operators SET password_hash = ? WHERE username = ?", (_ph.hash(password), username))
        con.execute("DELETE FROM sessions WHERE operator_id = (SELECT id FROM operators WHERE username = ?)", (username,))


def verify(username: str, password: str) -> sqlite3.Row | None:
    with office_db.connect() as con:
        row = con.execute("SELECT * FROM operators WHERE username = ?", (username,)).fetchone()
    try:
        _ph.verify(row["password_hash"] if row else _DUMMY, password)
    except (VerificationError, InvalidHashError):
        return None
    return row


def new_session(operator_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with office_db.connect() as con:
        con.execute("DELETE FROM sessions WHERE expires_at < ?", (office_db.now(),))
        con.execute("INSERT INTO sessions (token_hash, operator_id, expires_at) VALUES (?,?,?)",
                    (_hash_token(token), operator_id, _expiry()))
    return token


def end_session(token: str | None) -> None:
    if token:
        with office_db.connect() as con:
            con.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def public(row) -> dict:
    return {"username": row["username"], "display_name": row["display_name"], "is_admin": bool(row["is_admin"])}


def current_operator(request: Request, response: Response) -> dict:
    """Dependency for every /api/operator/* route except login; slides the expiry."""
    token = request.cookies.get(COOKIE)
    if token:
        h = _hash_token(token)
        with office_db.connect() as con:
            row = con.execute(
                "SELECT o.* FROM sessions s JOIN operators o ON o.id = s.operator_id "
                "WHERE s.token_hash = ? AND s.expires_at > ?", (h, office_db.now())).fetchone()
            if row:
                con.execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", (_expiry(), h))
                response.set_cookie(COOKIE, token, max_age=int(TTL.total_seconds()), httponly=True,
                                    samesite="lax", secure=is_https(request), path="/")
                return {"id": row["id"], **public(row)}
    raise HTTPException(401, "unauthorized: log in first")


def is_https(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https" \
        or '"scheme":"https"' in request.headers.get("cf-visitor", "")
