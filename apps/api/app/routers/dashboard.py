from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..config import settings
from ..services import analysis, llm, ratelimit
from ..services.dashboard_data import get_dashboard
from .assistant import MSG_LIMIT, _friendly

router = APIRouter(prefix="/dashboard", tags=["panel"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    return get_dashboard(db)


@router.get("/analysis")
def cached_analysis(db: Session = Depends(get_db)):
    """Último análisis y si sigue vigente (los datos no cambiaron). No consulta al modelo."""
    found = analysis.latest(db)
    return {"available": True, **found} if found else {"available": False}


@router.post("/analysis")
def make_analysis(refresh: bool = False, db: Session = Depends(get_db)):
    ok, var = llm.configured()
    if not ok:
        raise HTTPException(503, f"El asistente no está configurado. Falta {var} en el archivo .env.")
    ratelimit.limit("analysis", settings.ai_analysis_per_10min, 600, MSG_LIMIT)
    try:
        return {"available": True, **analysis.analyze(db, force=refresh)}
    except Exception as exc:
        raise HTTPException(502, _friendly(exc))
