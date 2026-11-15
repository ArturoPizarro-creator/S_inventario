"""Llamadas al modelo de lenguaje configurado, con reintentos y modelo alternativo."""
import time

from ..config import settings

RETRY = {500, 502, 503}  # fallas rápidas y temporales de Google: se reintenta
SWITCH = RETRY | {504, 429, 404}  # con estos errores se prueba el modelo alternativo (504 = se agotó la espera)
_sleep = time.sleep
_used: dict[str, str] = {}
_no_thinking = {"on": False}  # se activa si el modelo rechaza el nivel de razonamiento


def configured() -> tuple[bool, str]:
    if settings.llm_provider.lower() == "claude":
        return bool(settings.anthropic_api_key), "ANTHROPIC_API_KEY"
    return bool(settings.gemini_api_key), "GEMINI_API_KEY"


def model_name() -> str:
    return settings.anthropic_model if settings.llm_provider.lower() == "claude" else settings.gemini_model


def used_model() -> str:
    """Modelo que realmente respondió la última vez (puede ser el alternativo)."""
    return _used.get("model") or model_name()


def status_code(exc: Exception) -> int | None:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if isinstance(code, int):
        return code
    if isinstance(exc, TimeoutError) or type(exc).__name__ in ("ReadTimeout", "ConnectTimeout", "TimeoutException", "ConnectError"):
        return 504  # se agotó la espera: no se reintenta (otra espera igual de larga), se pasa al modelo alternativo
    return None


def new_gemini_client():
    from google import genai
    from google.genai import types

    return genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=settings.gemini_timeout_seconds * 1000),
    )


def gen_config(types, **kw):
    """Configuración de la consulta, con razonamiento bajo para que responda más rápido."""
    level = settings.gemini_thinking_level.strip()
    if level and not _no_thinking["on"]:
        try:
            kw["thinking_config"] = types.ThinkingConfig(thinking_level=level)
        except Exception:  # SDK antiguo sin esta opción
            pass
    return types.GenerateContentConfig(**kw)


def generate(client, model: str, contents, make_cfg):
    """Una consulta a Gemini con reintentos. Si el modelo rechaza el nivel de razonamiento, repite sin él."""

    def go():
        return client.models.generate_content(model=model, contents=contents, config=make_cfg())

    try:
        return retrying(go)
    except Exception as exc:
        if status_code(exc) == 400 and "thinking" in str(exc).lower() and not _no_thinking["on"]:
            _no_thinking["on"] = True
            return retrying(go)
        raise


def gemini_models() -> list[str]:
    out: list[str] = []
    for m in (settings.gemini_model, settings.gemini_fallback_model):
        if m and m not in out:
            out.append(m)
    return out


def retrying(call, attempts: int = 3, base: float = 1.5):
    """Repite la llamada si Google responde con una falla temporal (por ejemplo 503: mucha demanda)."""
    for i in range(attempts):
        try:
            return call()
        except Exception as exc:
            if status_code(exc) in RETRY and i < attempts - 1:
                _sleep(base * (2**i))
                continue
            raise


def with_fallback(run):
    """run(modelo) se prueba con el modelo principal y luego con el alternativo."""
    first: Exception | None = None
    for m in gemini_models():
        try:
            result = run(m)
            _used["model"] = m
            return result
        except Exception as exc:
            if status_code(exc) in SWITCH:
                first = first or exc
                continue
            raise
    raise first  # type: ignore[misc]


def complete(system: str, prompt: str, *, json_mode: bool = False, client=None) -> str:
    if settings.llm_provider.lower() == "claude":
        import anthropic

        c = client or anthropic.Anthropic(api_key=settings.anthropic_api_key)
        r = c.messages.create(
            model=settings.anthropic_model, max_tokens=1800, system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in r.content if b.type == "text")

    from google.genai import types

    if client is None:
        client = new_gemini_client()
    extra = {"response_mime_type": "application/json"} if json_mode else {}
    make_cfg = lambda: gen_config(types, system_instruction=system, **extra)  # noqa: E731
    return with_fallback(lambda m: generate(client, m, prompt, make_cfg).text or "")
