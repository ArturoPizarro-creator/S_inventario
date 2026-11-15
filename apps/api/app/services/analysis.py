"""Análisis del panel con IA: el sistema calcula las cifras y el modelo las explica y prioriza."""
import hashlib
import json
import logging
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import Product
from . import llm
from .dashboard_data import get_dashboard
from .forecast import forecast_product

log = logging.getLogger("fargoz")
_CACHE: dict[str, dict] = {}
_LAST: dict = {"key": None, "result": None}  # último análisis generado, para mostrarlo plegado y saber si sigue vigente

SYSTEM = (
    "Eres un analista de inventario de Fargoz Racing, una tienda de accesorios, indumentaria y repuestos para "
    "motociclistas. Recibes los datos del panel de stock en JSON y los explicas en español claro, para alguien "
    "que no es técnico. Usa SOLO los datos recibidos: no inventes cifras, productos ni causas. Si algo no se puede "
    "saber con esos datos, dilo. Cuando un producto tenga pocos meses de historial (menos de 12), advierte que la "
    "predicción es poco fiable. El último mes del gráfico está incompleto: no lo compares como si hubiera terminado. "
    "Responde SOLO con un JSON con estas claves: "
    '"grafico" (3 a 4 frases que expliquen el gráfico de entradas y salidas por mes: tendencia, mes más alto y más bajo '
    "con sus unidades, y si faltan entradas; apóyate en estadisticas_del_grafico), "
    '"resumen" (2 a 3 frases sobre los indicadores y los productos más vendidos), '
    '"alertas" (lista de hasta 5 textos cortos sobre productos o situaciones en riesgo, de más a menos urgente), '
    '"sugerencias" (lista de hasta 6 acciones directas, en imperativo, cada una con producto y unidades cuando haya '
    'pedido_sugerido, por ejemplo "Pide 120 unidades de Casco integral"; si un producto no tiene pedido_sugerido, '
    'sugiere registrar más historial), '
    '"confianza" ("alta", "media" o "baja", según la cantidad de historial disponible). Texto plano, sin Markdown.'
)


def chart_stats(monthly: list[dict]) -> dict:
    """Cifras del gráfico calculadas aquí, para que el modelo explique sin hacer cuentas."""
    done, current = monthly[:-1], monthly[-1]
    outs = [m["out"] for m in done]
    ins = [m["in"] for m in done]
    hi = max(done, key=lambda m: m["out"])
    lo = min(done, key=lambda m: m["out"])
    last3, prev3 = outs[-3:], outs[-6:-3]
    change = None
    trend = "sin datos suficientes"
    if prev3 and sum(prev3):
        change = round((sum(last3) / len(last3)) / (sum(prev3) / len(prev3)) * 100 - 100, 1)
        trend = "sube" if change > 10 else "baja" if change < -10 else "estable"
    return {
        "meses_completos": len(done),
        "total_salidas": sum(outs),
        "total_entradas": sum(ins),
        "promedio_salidas_por_mes": round(sum(outs) / len(outs), 1) if outs else 0,
        "mes_con_mas_salidas": {"mes": hi["month"], "unidades": hi["out"]},
        "mes_con_menos_salidas": {"mes": lo["month"], "unidades": lo["out"]},
        "tendencia_ultimos_3_meses_vs_3_anteriores": {"resultado": trend, "cambio_porcentual": change},
        "meses_sin_entradas": sum(1 for v in ins if v == 0),
        "mes_actual_incompleto": {"mes": current["month"], "salidas": current["out"], "entradas": current["in"]},
    }


def build_summary(db: Session) -> dict:
    d = get_dashboard(db)
    low = []
    for p in d["low_stock"][:8]:
        item = {"producto": p["name"], "sku": p["sku"], "stock": p["stock"], "minimo": p["min_stock"]}
        try:
            prod = db.get(Product, p["id"])
            f = forecast_product(db, prod, 3)
            item |= {
                "meses_de_historial": f["history_months"],
                "demanda_esperada_3_meses": round(sum(x["units"] for x in f["forecast"]), 1) if f["forecast"] else None,
                "pedido_sugerido": f["suggested_order"],
            }
        except Exception:
            log.exception("No se pudo predecir %s para el análisis", p["sku"])
        low.append(item)
    return {
        "productos_registrados": d["products_total"],
        "unidades_en_stock": d["units_in_stock"],
        "movimientos_registrados": d["movements_total"],
        "productos_con_stock_bajo": len(d["low_stock"]),
        "entradas_y_salidas_por_mes": d["monthly"],
        "estadisticas_del_grafico": chart_stats(d["monthly"]),
        "mas_vendidos_ultimos_30_dias": d["top_sellers"],
        "detalle_stock_bajo": low,
    }


def _key(summary: dict) -> str:
    raw = json.dumps(summary, sort_keys=True, default=str) + llm.model_name()
    return hashlib.sha256(raw.encode()).hexdigest()


def latest(db: Session) -> dict | None:
    """Último análisis, con `vigente` = los datos son los mismos de cuando se generó. No consulta al modelo."""
    if not _LAST["result"]:
        return None
    return {**_LAST["result"], "cached": True, "vigente": _LAST["key"] == _key(build_summary(db))}


def _parse(raw: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    try:
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError
    except ValueError:
        return {"grafico": "", "resumen": raw.strip()[:1500], "alertas": [], "sugerencias": [], "confianza": "media"}

    def lista(v):
        return [str(x)[:400] for x in v][:6] if isinstance(v, list) else []

    conf = str(data.get("confianza", "media")).lower()
    return {
        "grafico": str(data.get("grafico", ""))[:1500],
        "resumen": str(data.get("resumen", ""))[:1500],
        "alertas": lista(data.get("alertas")),
        "sugerencias": lista(data.get("sugerencias") or data.get("recomendaciones")),
        "confianza": conf if conf in ("alta", "media", "baja") else "media",
    }


def analyze(db: Session, force: bool = False, client=None) -> dict:
    summary = build_summary(db)
    key = _key(summary)
    if not force and key in _CACHE:
        _LAST.update(key=key, result=_CACHE[key])
        return {**_CACHE[key], "cached": True, "vigente": True}
    raw = llm.complete(SYSTEM, "Datos del panel (JSON):\n" + json.dumps(summary, ensure_ascii=False, default=str), json_mode=True, client=client)
    result = {
        **_parse(raw),
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),  # con zona horaria: cada navegador la muestra en su hora
        "modelo": llm.used_model(),
        "datos": summary,
        "cached": False,
    }
    if len(_CACHE) >= 50:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[key] = result
    _LAST.update(key=key, result=result)
    return {**result, "vigente": True}
