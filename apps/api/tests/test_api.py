"""Pruebas básicas con SQLite en memoria (no necesitan Docker ni PostgreSQL)."""
import os
from datetime import datetime, timedelta

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ADMIN_PASSWORD"] = "secreto"
os.environ["JWT_SECRET"] = "test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

from app import db as dbmod
from app.main import app
from app.models import Movement, Product

# SQLite en memoria: una sola conexión compartida
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
dbmod.Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine, autoflush=False)


def override_db():
    s = TestSession()
    try:
        yield s
    finally:
        s.close()


app.dependency_overrides[dbmod.get_db] = override_db


@pytest.fixture()
def client():
    c = TestClient(app)
    r = c.post("/auth/login", json={"username": "admin", "password": "secreto"})
    assert r.status_code == 200
    return c


def test_requires_login():
    assert TestClient(app).get("/products").status_code == 401


def test_wrong_password():
    r = TestClient(app).post("/auth/login", json={"username": "admin", "password": "x"})
    assert r.status_code == 401


def test_product_crud_and_movements(client):
    r = client.post("/products", json={"sku": "T-1", "name": "Prueba", "stock": 5, "min_stock": 10})
    assert r.status_code == 201
    pid = r.json()["id"]
    assert client.post("/products", json={"sku": "T-1", "name": "Otro"}).status_code == 409

    assert client.put(f"/products/{pid}", json={"sku": "T-1", "name": "Prueba 2", "stock": 5, "min_stock": 10}).json()["name"] == "Prueba 2"
    assert client.post("/movements", json={"product_id": pid, "kind": "out", "quantity": 99}).status_code == 409
    assert client.post("/movements", json={"product_id": pid, "kind": "in", "quantity": 20}).json()["stock"] == 25

    d = client.get("/dashboard").json()
    assert d["products_total"] >= 1 and len(d["monthly"]) == 12

    assert client.delete(f"/products/{pid}").status_code == 204
    assert client.get("/forecast/999").status_code == 404


def test_forecast_methods(client):
    s = TestSession()
    today = datetime.now().replace(day=1)
    for sku, months in (("F-3", 3), ("F-8", 8), ("F-24", 24)):
        p = Product(sku=sku, name=sku, stock=10, min_stock=5)
        s.add(p)
        s.flush()
        for m in range(1, months + 1):
            s.add(Movement(product_id=p.id, kind="out", quantity=20 + (m % 5) * 3,
                           moved_at=today - timedelta(days=30 * m)))
    s.commit()
    by_sku = {p.sku: p.id for p in s.query(Product).all()}
    s.close()

    assert client.get(f"/forecast/{by_sku['F-3']}").json()["method"] == "sin_datos_suficientes"
    assert client.get(f"/forecast/{by_sku['F-8']}").json()["method"] == "promedio_movil_3m"
    f = client.get(f"/forecast/{by_sku['F-24']}?horizon=4").json()
    assert f["method"] == "xgboost" and len(f["forecast"]) == 4 and f["metrics"]["mae"] >= 0
    assert len(f["history"]) == 12

    restock = client.get("/forecast/restock/all").json()
    assert restock[-1]["suggested_order"] is None  # sin datos va al final


def test_assistant_gemini_with_tools(client, monkeypatch):
    """Gemini simulado: primero pide una herramienta y luego redacta la respuesta con su resultado."""
    pytest.importorskip("google.genai")
    from types import SimpleNamespace

    from google.genai import types

    from app.config import settings
    from app.services import assistant

    monkeypatch.setattr(settings, "gemini_api_key", "x")
    monkeypatch.setattr(settings, "llm_provider", "gemini")

    seen = {}

    class FakeModels:
        def __init__(self):
            self.n = 0

        def generate_content(self, model, contents, config):
            self.n += 1
            if self.n == 1:
                call = types.FunctionCall(name="low_stock", args={}, id="call-1")  # el Gemini real sí envía id
                content = types.Content(role="model", parts=[types.Part(function_call=call)])
                return SimpleNamespace(candidates=[SimpleNamespace(content=content)])
            # segunda vuelta: debe llegar el resultado de la herramienta
            seen["last"] = contents[-1].parts[0].function_response
            content = types.Content(role="model", parts=[types.Part(text="Hay productos con stock bajo.")])
            return SimpleNamespace(candidates=[SimpleNamespace(content=content)])

    fake = SimpleNamespace(models=FakeModels())
    s = TestSession()
    out = assistant._chat_gemini(s, "¿Qué falta?", [{"role": "user", "content": "hola"}], client=fake)
    s.close()
    assert out == "Hay productos con stock bajo."
    assert seen["last"].name == "low_stock" and "result" in seen["last"].response
    assert seen["last"].id == "call-1"


def test_assistant_endpoint_needs_key(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    assert client.get("/assistant/status").json()["configured"] is False
    assert client.post("/assistant/chat", json={"message": "hola", "history": []}).status_code == 503


def test_login_throttle():
    c = TestClient(app)
    codes = [c.post("/auth/login", json={"username": "intruso", "password": "mal"}).status_code for _ in range(7)]
    assert codes[:5] == [401] * 5 and codes[5] == 429


def test_import_numeric_sku_with_blanks(client):
    """Un SKU numérico con celdas vacías llega como 1001.0 desde Excel: debe tratarse como '1001'."""
    import io

    import pandas as pd

    def xlsx(df):
        b = io.BytesIO()
        df.to_excel(b, index=False)
        b.seek(0)
        return b

    prod = pd.DataFrame({"sku": [1001, 1002, None], "nombre": ["Llanta", "Cadena", "sin sku"], "stock": [10, None, 5]})
    r = client.post("/products/import", files={"file": ("p.xlsx", xlsx(prod))})
    assert r.status_code == 200 and r.json()["created"] == 2

    mov = pd.DataFrame(
        {"sku": [1001, None, 9999], "fecha": ["05/03/2026"] * 3, "tipo": ["Venta"] * 3, "cantidad": [4, 4, None]}
    )
    r = client.post("/movements/import", files={"file": ("m.xlsx", xlsx(mov))}).json()
    assert r["added"] == 1 and r["skipped"] == 2


def test_dashboard_analysis_with_fake_model(client, monkeypatch):
    """El modelo (simulado) recibe las cifras del panel; la respuesta se ordena y se guarda en caché."""
    from types import SimpleNamespace

    from app.config import settings
    from app.services import analysis

    monkeypatch.setattr(settings, "gemini_api_key", "x")
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    analysis._CACHE.clear()
    llamadas = {"n": 0, "prompt": ""}

    class FakeModels:
        def generate_content(self, model, contents, config):
            llamadas["n"] += 1
            llamadas["prompt"] = contents
            texto = '{"grafico": "G", "resumen": "Todo estable.", "alertas": ["A1"], "sugerencias": ["R1", "R2"], "confianza": "baja"}'
            return SimpleNamespace(text=texto)

    fake = SimpleNamespace(models=FakeModels())
    s = TestSession()
    r1 = analysis.analyze(s, client=fake)
    r2 = analysis.analyze(s, client=fake)  # mismos datos: no vuelve a consultar al modelo
    s.close()
    assert llamadas["n"] == 1 and r2["cached"] is True
    assert r1["confianza"] == "baja" and r1["sugerencias"] == ["R1", "R2"] and r1["grafico"] == "G"
    assert "productos_registrados" in llamadas["prompt"] and "estadisticas_del_grafico" in llamadas["prompt"]


def test_analysis_parse_is_forgiving():
    from app.services.analysis import _parse

    assert _parse("```json\n{\"resumen\": \"ok\", \"confianza\": \"rara\"}\n```")["confianza"] == "media"
    assert _parse("texto suelto, no JSON")["resumen"] == "texto suelto, no JSON"


def test_analysis_endpoints(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "gemini_api_key", "")
    assert client.get("/dashboard/analysis").json()["available"] in (True, False)
    assert client.post("/dashboard/analysis").status_code == 503


def test_remember_me_extends_session():
    c = TestClient(app)
    corta = c.post("/auth/login", json={"username": "admin", "password": "secreto"})
    larga = c.post("/auth/login", json={"username": "admin", "password": "secreto", "remember": True})
    assert "Max-Age=43200" in corta.headers["set-cookie"]  # 12 h
    assert "Max-Age=2592000" in larga.headers["set-cookie"]  # 30 días


class _Err(Exception):
    def __init__(self, code):
        super().__init__(f"{code} error simulado")
        self.code = code


def test_timeout_goes_straight_to_fallback_without_retrying(monkeypatch):
    """Una espera agotada no se repite (sería otra espera larga): se pasa directo al modelo alternativo."""
    from app.config import settings
    from app.services import llm

    monkeypatch.setattr(llm, "_sleep", lambda s: None)
    monkeypatch.setattr(settings, "gemini_model", "lento")
    monkeypatch.setattr(settings, "gemini_fallback_model", "rapido")
    llamadas = []

    class ReadTimeout(Exception):
        pass

    def run(modelo):
        def call():
            llamadas.append(modelo)
            if modelo == "lento":
                raise ReadTimeout("timed out")
            return "listo"

        return llm.retrying(call)

    assert llm.with_fallback(run) == "listo"
    assert llamadas == ["lento", "rapido"]  # sin reintentos en el modelo lento


def test_thinking_level_rejected_is_retried_without_it(monkeypatch):
    from types import SimpleNamespace

    from google.genai import types

    from app.config import settings
    from app.services import llm

    monkeypatch.setattr(settings, "gemini_thinking_level", "low")
    monkeypatch.setitem(llm._no_thinking, "on", False)
    vistos = []

    class FakeModels:
        def generate_content(self, model, contents, config):
            vistos.append(config.thinking_config is not None)
            if config.thinking_config is not None:
                raise _Err(400)
            return SimpleNamespace(text="ok")

    _orig = _Err.__str__
    _Err.__str__ = lambda self: "400 INVALID_ARGUMENT: thinking_level no es compatible"
    try:
        r = llm.generate(SimpleNamespace(models=FakeModels()), "m", "hola", lambda: llm.gen_config(types))
    finally:
        _Err.__str__ = _orig
    assert r.text == "ok" and vistos == [True, False]
    llm._no_thinking["on"] = False


def test_retry_on_503_then_success(monkeypatch):
    from app.services import llm

    monkeypatch.setattr(llm, "_sleep", lambda s: None)
    n = {"c": 0}

    def call():
        n["c"] += 1
        if n["c"] < 3:
            raise _Err(503)
        return "ok"

    assert llm.retrying(call) == "ok" and n["c"] == 3


def test_fallback_model_used_when_primary_is_overloaded(monkeypatch):
    from app.config import settings
    from app.services import llm

    monkeypatch.setattr(llm, "_sleep", lambda s: None)
    monkeypatch.setattr(settings, "gemini_model", "principal")
    monkeypatch.setattr(settings, "gemini_fallback_model", "alternativo")
    usados = []

    def run(modelo):
        usados.append(modelo)
        if modelo == "principal":
            raise _Err(503)
        return "respuesta"

    assert llm.with_fallback(run) == "respuesta"
    assert usados == ["principal", "alternativo"] and llm.used_model() == "alternativo"


def test_fallback_does_not_hide_real_errors(monkeypatch):
    from app.config import settings
    from app.services import llm

    monkeypatch.setattr(settings, "gemini_model", "principal")
    monkeypatch.setattr(settings, "gemini_fallback_model", "alternativo")

    def run(modelo):
        raise _Err(403)  # clave inválida: no tiene sentido probar otro modelo

    with pytest.raises(_Err):
        llm.with_fallback(run)


def test_503_with_both_models_gives_friendly_message(monkeypatch):
    from app.config import settings
    from app.routers.assistant import _friendly
    from app.services import llm

    monkeypatch.setattr(llm, "_sleep", lambda s: None)
    monkeypatch.setattr(settings, "gemini_model", "a")
    monkeypatch.setattr(settings, "gemini_fallback_model", "b")
    with pytest.raises(_Err) as info:
        llm.with_fallback(lambda m: (_ for _ in ()).throw(_Err(503)))
    assert "saturado" in _friendly(info.value)


def test_chart_stats_ignores_incomplete_month():
    from app.services.analysis import chart_stats

    meses = [{"month": f"2026-{i:02d}", "in": 0, "out": 100 + i * 10} for i in range(1, 12)] + [{"month": "2026-12", "in": 0, "out": 5}]
    s = chart_stats(meses)
    assert s["mes_actual_incompleto"]["mes"] == "2026-12"
    assert s["mes_con_menos_salidas"]["unidades"] == 110 and s["mes_con_mas_salidas"]["unidades"] == 210
    assert s["tendencia_ultimos_3_meses_vs_3_anteriores"]["resultado"] == "sube"


def test_analysis_goes_stale_when_data_changes(client, monkeypatch):
    """Tras generar el análisis, si alguien registra un movimiento, el panel lo marca como desactualizado."""
    from types import SimpleNamespace

    from app.config import settings
    from app.services import analysis

    monkeypatch.setattr(settings, "gemini_api_key", "x")
    analysis._CACHE.clear()
    analysis._LAST.update(key=None, result=None)
    fake = SimpleNamespace(models=SimpleNamespace(
        generate_content=lambda model, contents, config: SimpleNamespace(text='{"grafico": "g", "resumen": "r", "alertas": [], "sugerencias": [], "confianza": "alta"}')
    ))
    s = TestSession()
    nuevo = analysis.analyze(s, client=fake)
    assert nuevo["vigente"] is True and nuevo["generado"].endswith("+00:00")
    assert analysis.latest(s)["vigente"] is True

    p = Product(sku="STALE-1", name="Nuevo", stock=1, min_stock=1)
    s.add(p)
    s.commit()
    assert analysis.latest(s)["vigente"] is False  # los datos cambiaron
    s.close()
    assert client.get("/dashboard/analysis").json()["vigente"] is False


def test_database_url_from_neon_or_render_is_normalized():
    import importlib

    import app.config as cfg

    old = os.environ.get("DATABASE_URL")
    try:
        os.environ["DATABASE_URL"] = "postgresql://u:p@host/db?sslmode=require"
        importlib.reload(cfg)
        assert cfg.settings.database_url.startswith("postgresql+psycopg://u:p@host/db")
        os.environ["DATABASE_URL"] = "postgres://u:p@host/db"
        importlib.reload(cfg)
        assert cfg.settings.database_url.startswith("postgresql+psycopg://")
    finally:
        os.environ["DATABASE_URL"] = old or "sqlite://"
        importlib.reload(cfg)
