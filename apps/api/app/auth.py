"""Inicio de sesión con un usuario administrador y token JWT en cookie httpOnly."""
import hmac
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from .config import settings

COOKIE = "token"
MAX_FAILS, WINDOW = 5, 300  # 5 intentos fallidos cada 5 minutos
_fails: dict[str, list[float]] = defaultdict(list)
router = APIRouter(prefix="/auth", tags=["sesión"])


class LoginIn(BaseModel):
    username: str
    password: str
    remember: bool = False


def _same(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def require_user(token: str | None = Cookie(default=None, alias=COOKIE)) -> str:
    if not token:
        raise HTTPException(401, "Inicia sesión para continuar.")
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "La sesión venció. Vuelve a iniciar sesión.")
    return data["sub"]


@router.post("/login")
def login(data: LoginIn, request: Request, response: Response):
    key = data.username.lower()
    now = time.time()
    _fails[key] = [t for t in _fails[key] if now - t < WINDOW]
    if len(_fails[key]) >= MAX_FAILS:
        raise HTTPException(429, "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.")
    if not settings.admin_password:
        raise HTTPException(503, "Falta ADMIN_PASSWORD en el archivo .env.")
    if not (_same(data.username, settings.admin_user) and _same(data.password, settings.admin_password)):
        _fails[key].append(now)
        raise HTTPException(401, "Usuario o contraseña incorrectos.")
    _fails.pop(key, None)
    hours = settings.remember_days * 24 if data.remember else settings.token_hours
    exp = datetime.now(timezone.utc) + timedelta(hours=hours)
    token = jwt.encode({"sub": data.username, "exp": exp}, settings.jwt_secret, algorithm="HS256")
    response.set_cookie(
        COOKIE, token, max_age=hours * 3600, httponly=True,
        samesite="lax", secure=settings.cookie_secure, path="/",
    )
    return {"user": data.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: str = Depends(require_user)):
    return {"user": user}
