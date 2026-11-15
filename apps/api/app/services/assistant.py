"""Asistente conversacional: el LLM consulta y explica; los cálculos los hace el sistema.

El modelo no calcula nada por su cuenta: usa herramientas que leen PostgreSQL
(stock real, salidas, predicción del modelo de aprendizaje automático).
"""
import json
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from . import llm
from ..models import Movement, Product
from .forecast import forecast_product

SYSTEM = (
    "Eres el asistente de inventario de Fargoz Racing, una empresa que importa y vende "
    "accesorios, indumentaria y repuestos para motociclistas. Respondes en español, con frases "
    "cortas y claras, en texto plano (sin Markdown ni tablas). Usa SIEMPRE las herramientas para obtener stock, salidas y predicciones. "
    "Responde solo con los datos que devuelven las herramientas; si no hay información, dilo. "
    "No inventes cifras ni hagas cálculos de predicción por tu cuenta: la predicción la entrega "
    "la herramienta 'forecast'."
)

TOOLS = [
    {
        "name": "search_products",
        "description": "Busca productos por nombre o SKU y devuelve su stock actual y su stock mínimo.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Nombre o SKU"}},
            "required": ["query"],
        },
    },
    {
        "name": "low_stock",
        "description": "Lista los productos cuyo stock es menor o igual al stock mínimo.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "forecast",
        "description": "Predicción de demanda de los próximos meses para un producto (por nombre o SKU), con la cantidad sugerida a pedir.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "horizon": {"type": "integer", "description": "Meses a predecir (1 a 6)", "default": 3},
            },
            "required": ["query"],
        },
    },
    {
        "name": "top_sellers",
        "description": "Productos con más salidas (unidades vendidas) en los últimos días.",
        "input_schema": {
            "type": "object",
            "properties": {"days": {"type": "integer", "default": 30}},
        },
    },
]


def _find(db: Session, query: str):
    like = f"%{query}%"
    return db.scalars(
        select(Product).where(or_(Product.name.ilike(like), Product.sku.ilike(like))).limit(10)
    ).all()


def _brief(p: Product) -> dict:
    return {"sku": p.sku, "name": p.name, "stock": p.stock, "min_stock": p.min_stock}


def run_tool(db: Session, name: str, args: dict):
    if name == "search_products":
        found = _find(db, args.get("query", ""))
        return [_brief(p) for p in found] or {"message": "No se encontraron productos."}
    if name == "low_stock":
        rows = db.scalars(select(Product).where(Product.stock <= Product.min_stock)).all()
        return [_brief(p) for p in rows]
    if name == "forecast":
        found = _find(db, args.get("query", ""))
        if not found:
            return {"message": "No se encontró el producto."}
        horizon = min(max(int(args.get("horizon", 3)), 1), 6)
        return forecast_product(db, found[0], horizon)
    if name == "top_sellers":
        since = datetime.now() - timedelta(days=int(args.get("days", 30)))
        rows = db.execute(
            select(Product.name, func.sum(Movement.quantity).label("units"))
            .join(Movement, Movement.product_id == Product.id)
            .where(Movement.kind == "out", Movement.moved_at >= since)
            .group_by(Product.name)
            .order_by(func.sum(Movement.quantity).desc())
            .limit(5)
        ).all()
        return [{"name": r[0], "units": int(r[1])} for r in rows]
    return {"message": "Herramienta desconocida."}


def _plain(obj):
    """Convierte el resultado de una herramienta a tipos simples (JSON)."""
    return json.loads(json.dumps(obj, ensure_ascii=False, default=str))


def _chat_claude(db: Session, message: str, history: list[dict]) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    messages = [*history, {"role": "user", "content": message}]
    for _ in range(5):
        resp = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1000,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")
        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type == "tool_use":
                out = run_tool(db, block.name, block.input)
                results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(out, ensure_ascii=False, default=str)}
                )
        messages.append({"role": "user", "content": results})
    return "No pude completar la consulta. Intenta con una pregunta más específica."


def _gemini_declarations(types):
    """Mismas herramientas, en el formato de Gemini. Gemini no admite objetos sin propiedades."""
    decls = []
    for t in TOOLS:
        schema = t["input_schema"]
        decl = {"name": t["name"], "description": t["description"]}
        if schema.get("properties"):
            decl["parameters"] = schema
        decls.append(types.FunctionDeclaration(**decl))
    return decls


def _chat_gemini(db: Session, message: str, history: list[dict], client=None, model: str | None = None) -> str:
    from google.genai import types

    if client is None:
        client = llm.new_gemini_client()

    contents = [
        types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
        for m in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))
    tools = [types.Tool(function_declarations=_gemini_declarations(types))]
    make_cfg = lambda: llm.gen_config(types, system_instruction=SYSTEM, tools=tools)  # noqa: E731

    for _ in range(5):
        resp = llm.generate(client, model or settings.gemini_model, contents, make_cfg)
        cand = resp.candidates[0] if resp.candidates else None
        parts = (cand.content.parts or []) if cand and cand.content else []
        calls = [p.function_call for p in parts if getattr(p, "function_call", None)]
        if not calls:
            text = "".join(p.text for p in parts if getattr(p, "text", None) and not getattr(p, "thought", False))
            return text or "No pude generar una respuesta. Intenta reformular la pregunta."
        contents.append(cand.content)  # se conserva tal cual (incluye las firmas de razonamiento)
        responses = [
            types.Part(
                function_response=types.FunctionResponse(
                    id=getattr(c, "id", None),  # Gemini envía un id por llamada y espera recibirlo de vuelta
                    name=c.name,
                    response={"result": _plain(run_tool(db, c.name, dict(c.args or {})))},
                )
            )
            for c in calls
        ]
        contents.append(types.Content(role="user", parts=responses))
    return "No pude completar la consulta. Intenta con una pregunta más específica."


def chat(db: Session, message: str, history: list[dict]) -> str:
    if settings.llm_provider.lower() == "claude":
        return _chat_claude(db, message, history)
    return llm.with_fallback(lambda m: _chat_gemini(db, message, history, model=m))
