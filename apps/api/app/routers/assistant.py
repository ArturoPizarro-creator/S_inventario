import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..schemas import ChatIn
from ..services import assistant, llm, ratelimit

router = APIRouter(prefix="/assistant", tags=["asistente"])
MSG_LIMIT = "Hiciste muchas consultas seguidas. Espera unos minutos para no agotar el límite gratuito de Gemini."


def _friendly(exc: Exception) -> str:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    text = str(exc)
    if code in (500, 502, 503, 504) or "UNAVAILABLE" in text:
        return "El modelo de Google está saturado en este momento. Reintenté varias veces y probé con un modelo alternativo sin éxito. Espera uno o dos minutos y vuelve a intentarlo."
    if code == 429 or "RESOURCE_EXHAUSTED" in text:
        return "Se agotó el límite gratuito del modelo (por minuto o por día). Espera un momento e inténtalo de nuevo."
    if code in (400, 401, 403) and ("API key" in text or "API_KEY" in text or code in (401, 403)):
        return "La clave del modelo no es válida o no tiene permiso. Revisa GEMINI_API_KEY en el archivo .env."
    if code == 404:
        return "El modelo configurado no existe o no está disponible. Revisa GEMINI_MODEL en el archivo .env."
    return f"No se pudo consultar el modelo de lenguaje: {text[:300]}"


@router.get("/status")
def status():
    provider = settings.llm_provider.lower()
    key = settings.anthropic_api_key if provider == "claude" else settings.gemini_api_key
    model = settings.anthropic_model if provider == "claude" else settings.gemini_model
    return {"provider": provider, "model": model, "configured": bool(key)}


@router.post("/chat")
def chat(data: ChatIn, db: Session = Depends(get_db)):
    provider = settings.llm_provider.lower()
    if provider == "claude" and not settings.anthropic_api_key:
        raise HTTPException(503, "El asistente no está configurado. Falta ANTHROPIC_API_KEY en el archivo .env.")
    if provider != "claude" and not settings.gemini_api_key:
        raise HTTPException(503, "El asistente no está configurado. Falta GEMINI_API_KEY en el archivo .env.")
    ratelimit.limit("chat", settings.ai_chat_per_10min, 600, MSG_LIMIT)
    history = [m.model_dump() for m in data.history[-10:]]
    t0 = time.time()
    try:
        reply = assistant.chat(db, data.message, history)
    except Exception as exc:  # error del proveedor del modelo, red, etc.
        logging.getLogger("uvicorn.error").warning("Asistente: falló tras %.1f s (%s: %s)", time.time() - t0, type(exc).__name__, str(exc)[:160])
        raise HTTPException(502, _friendly(exc))
    logging.getLogger("uvicorn.error").info("Asistente: respondió en %.1f s con %s", time.time() - t0, llm.used_model())
    return {"reply": reply}
