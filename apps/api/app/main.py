from contextlib import asynccontextmanager

import logging

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registra las tablas)
from .auth import require_user
from .auth import router as auth_router
from .config import settings
from .db import Base, engine
from .routers import assistant, dashboard, forecast, movements, products


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


_prod = settings.environment.lower() == "production"
app = FastAPI(
    title="Fargoz Racing - Inventario inteligente",
    lifespan=lifespan,
    docs_url=None if _prod else "/docs",
    redoc_url=None,
    openapi_url=None if _prod else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    """Registra el error completo y devuelve el motivo, en vez de un 500 mudo."""
    logging.getLogger("fargoz").exception("Error no controlado en %s", request.url.path)
    return JSONResponse({"detail": f"Error interno ({type(exc).__name__}): {str(exc)[:200]}"}, status_code=500)


app.include_router(auth_router)
for r in (products.router, movements.router, dashboard.router, forecast.router, assistant.router):
    app.include_router(r, dependencies=[Depends(require_user)])


@app.get("/health", tags=["sistema"])
def health():
    return {"status": "ok"}
