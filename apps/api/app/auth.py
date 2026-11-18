"""Inicio de sesión con un usuario administrador y token JWT en cookie httpOnly."""
import hmac
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from .config import settings

COOKIE = "token"
MAX_FAILS, WINDOW = 5, 300  # por usuario + dirección: 5 fallos cada 5 minutos
MAX_FAILS_USER, WINDOW_USER = 20, 900  # por usuario, desde cualquier dirección: 20 fallos cada 15 minutos
_fails: dict[str, list[float]] = defaultdict(list)
audit = logging.getLogger("uvicorn.error")  # sale en «docker compose logs api»


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host if request.client else "?"


def _recent(key: str, window: int, now: float) -> list[float]:
    _fails[key] = [t for t in _fails[key] if now - t < window]
    if not _fails[key]:
        _fails.pop(key, None)
        return []
    return _fails[key]
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
    ip = client_ip(request)
    user = data.username.lower()[:100]
    pair, anyip = f"{ip}|{user}", f"u|{user}"
    now = time.time()
    if len(_recent(pair, WINDOW, now)) >= MAX_FAILS or len(_recent(anyip, WINDOW_USER, now)) >= MAX_FAILS_USER:
        audit.warning("Inicio de sesión BLOQUEADO por demasiados intentos: usuario=%s ip=%s", user, ip)
        raise HTTPException(429, "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.")
    if not settings.admin_password:
        raise HTTPException(503, "Falta ADMIN_PASSWORD en el archivo .env.")
    if not (_same(data.username, settings.admin_user) and _same(data.password, settings.admin_password)):
        _fails[pair].append(now)
        _fails[anyip].append(now)
        if len(_fails) > 5000:  # evita que la memoria crezca sin límite
            for k in list(_fails):
                _recent(k, WINDOW_USER, now)
        audit.warning("Inicio de sesión FALLIDO: usuario=%s ip=%s", user, ip)
        raise HTTPException(401, "Usuario o contraseña incorrectos.")
    _fails.pop(pair, None)
    audit.info("Inicio de sesión correcto: usuario=%s ip=%s", user, ip)
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
