"""Back-office API: /api/operator/* (spec §2). Every route except login needs a session."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from . import auth, ratelimit

router = APIRouter(prefix="/api/operator")
Operator = Depends(auth.current_operator)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


@router.post("/login")
def login(req: LoginRequest, request: Request, response: Response):
    if not ratelimit.LOGIN.hit(ratelimit.client_ip(request)):
        raise HTTPException(429, "rate_limited: too many login attempts, wait 10 minutes")
    row = auth.verify(req.username, req.password)
    if row is None:
        raise HTTPException(401, "unauthorized: wrong username or password")
    token = auth.new_session(row["id"])
    response.set_cookie(auth.COOKIE, token, max_age=int(auth.TTL.total_seconds()), httponly=True,
                        samesite="lax", secure=auth.is_https(request), path="/")
    return auth.public(row)


@router.post("/logout")
def logout(request: Request, response: Response):
    auth.end_session(request.cookies.get(auth.COOKIE))
    response.delete_cookie(auth.COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(op: dict = Operator):
    return {k: op[k] for k in ("username", "display_name", "is_admin")}
