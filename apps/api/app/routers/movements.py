import io

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Movement, Product
from ..schemas import MovementIn
from ..services.uploads import load_table
from ..services.normalize import clean_sku, is_blank

router = APIRouter(prefix="/movements", tags=["movimientos"])

KIND_ALIASES = {"entrada": "in", "in": "in", "salida": "out", "out": "out", "venta": "out"}


@router.post("", status_code=201)
def create_movement(data: MovementIn, db: Session = Depends(get_db)):
    """Registra una entrada o salida y actualiza el stock."""
    product = db.get(Product, data.product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado.")
    if data.kind == "out":
        if data.quantity > product.stock:
            raise HTTPException(409, f"Stock insuficiente: hay {product.stock} unidades.")
        product.stock -= data.quantity
    else:
        product.stock += data.quantity
    db.add(Movement(product_id=product.id, kind=data.kind, quantity=data.quantity, note=data.note))
    db.commit()
    return {"product_id": product.id, "stock": product.stock}


@router.get("")
def list_movements(
    product_id: int | None = Query(None),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(Movement, Product).join(Product, Product.id == Movement.product_id)
    if product_id:
        stmt = stmt.where(Movement.product_id == product_id)
    rows = db.execute(stmt.order_by(Movement.moved_at.desc()).limit(limit)).all()
    return [
        {
            "id": m.id, "sku": p.sku, "name": p.name, "kind": m.kind,
            "quantity": m.quantity, "moved_at": m.moved_at, "note": m.note,
        }
        for m, p in rows
    ]


@router.post("/import")
def import_movements(
    file: UploadFile = File(...),
    apply_stock: bool = Query(False, description="Si es true, también modifica el stock actual"),
    db: Session = Depends(get_db),
):
    """Carga el historial de movimientos (kardex) desde .xlsx o .csv.

    Columnas: sku, fecha, tipo (entrada o salida), cantidad.
    Por defecto NO cambia el stock actual: sirve para dar historial al modelo de predicción.
    """
    df = load_table(file)
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = {"sku", "fecha", "tipo", "cantidad"} - set(df.columns)
    if missing:
        raise HTTPException(400, f"Faltan columnas: {', '.join(sorted(missing))}.")

    products = {p.sku: p for p in db.scalars(select(Product)).all()}
    added = skipped = 0
    unknown: set[str] = set()
    for row in df.to_dict("records"):
        if is_blank(row["sku"]):
            skipped += 1
            continue
        sku = clean_sku(row["sku"])
        kind = KIND_ALIASES.get(str(row["tipo"]).strip().lower())
        when = pd.to_datetime(row["fecha"], dayfirst=True, errors="coerce")
        try:
            qty = int(row["cantidad"])
        except (TypeError, ValueError):
            qty = 0
        product = products.get(sku)
        if product is None:
            unknown.add(sku)
            skipped += 1
            continue
        if kind is None or pd.isna(when) or qty <= 0:
            skipped += 1
            continue
        db.add(Movement(product_id=product.id, kind=kind, quantity=qty, moved_at=when.to_pydatetime(), note="Importado"))
        if apply_stock:
            product.stock = max(0, product.stock + (qty if kind == "in" else -qty))
        added += 1
    db.commit()
    return {"added": added, "skipped": skipped, "unknown_skus": sorted(unknown)[:20]}
