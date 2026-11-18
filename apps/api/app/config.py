import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://fargoz:fargoz@db:5432/fargoz"
    # Proveedor del asistente: "gemini" (nivel gratuito) o "claude"
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    # Si el modelo principal está saturado (503) o sin cupo (429), se prueba este. Vacío = sin alternativo.
    gemini_fallback_model: str = "gemini-3.1-flash-lite"
    gemini_timeout_seconds: int = 30  # tiempo máximo de espera por cada consulta a Google
    # Nivel de razonamiento: minimal, low, medium o high. «low» responde bastante más rápido y basta para consultas de inventario.
    gemini_thinking_level: str = "low"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 10  # tamaño máximo de un Excel/CSV importado
    ai_chat_per_10min: int = 30  # consultas al asistente permitidas cada 10 minutos
    ai_analysis_per_10min: int = 12  # análisis del panel permitidos cada 10 minutos
    environment: str = "development"  # en «production» se ocultan /docs y /openapi.json

    # Inicio de sesión (un usuario administrador definido en .env)
    admin_user: str = "admin"
    admin_password: str = ""
    # Si queda vacío se genera uno al iniciar (las sesiones se cierran al reiniciar la API).
    jwt_secret: str = ""
    token_hours: int = 12
    remember_days: int = 30  # duración de la sesión si se marca «Recordarme»
    cookie_secure: bool = False  # ponlo en true cuando sirvas la web por HTTPS


def normalize_db_url(url: str) -> str:
    """Neon, Render y otros entregan «postgresql://…»; SQLAlchemy necesita indicar el driver instalado."""
    for old in ("postgres://", "postgresql://"):
        if url.startswith(old):
            return "postgresql+psycopg://" + url[len(old):]
    return url


settings = Settings()
settings.database_url = normalize_db_url(settings.database_url)
if not settings.jwt_secret:
    settings.jwt_secret = secrets.token_hex(32)
