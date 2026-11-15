import io

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Movement, Product
from ..services.normalize import clean_sku, is_blank
from ..schemas import ProductIn, ProductOut

router = APIRouter(prefix="/products", tags=["productos"])

# Columnas del Excel/CSV -> campos de la tabla
COLUMNS = {
    "sku": "sku",
    "nombre": "name",
    "categoria": "category",
    "stock": "stock",
    "stock_minimo": "min_stock",
}
NUMERIC = {"stock": int, "min_stock": int}


@router.get("", response_model=list[ProductOut])
def list_products(q: str = Query("", description="Buscar por nombre o SKU"), db: Session = Depends(get_db)):
    stmt = select(Product).order_by(Product.name)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    return db.scalars(stmt).all()


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    if db.scalar(select(Product).where(Product.sku == data.sku)):
        raise HTTPException(409, "Ya existe un producto con ese SKU.")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductIn, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado.")
    clash = db.scalar(select(Product).where(Product.sku == data.sku, Product.id != product_id))
    if clash:
        raise HTTPException(409, "Ya existe otro producto con ese SKU.")
    for k, v in data.model_dump().items():
        setattr(product, k, v)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Elimina el producto y su historial de movimientos."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado.")
    db.execute(delete(Movement).where(Movement.product_id == product_id))
    db.delete(product)
    db.commit()


@router.post("/import")
def import_products(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Carga productos desde .xlsx o .csv. Si el SKU ya existe, lo actualiza.

    Columnas: sku, nombre (obligatorias), categoria, stock, stock_minimo.
    """
    raw = file.file.read()
    name = (file.filename or "").lower()
    try:
        df = pd.read_csv(io.BytesIO(raw)) if name.endswith(".csv") else pd.read_excel(io.BytesIO(raw))
    except Exception:
        raise HTTPException(400, "No se pudo leer el archivo. Usa un .xlsx o .csv.")
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = {"sku", "nombre"} - set(df.columns)
    if missing:
        raise HTTPException(400, f"Faltan columnas obligatorias: {', '.join(sorted(missing))}.")

    created = updated = 0
    for row in df.to_dict("records"):
        if is_blank(row.get("sku")):
            continue
        sku = clean_sku(row["sku"])
        values = {}
        for col, field in COLUMNS.items():
            if col not in row or pd.isna(row[col]):
                continue
            try:
                values[field] = NUMERIC[field](row[col]) if field in NUMERIC else str(row[col]).strip()
            except (TypeError, ValueError):
                raise HTTPException(400, f"Valor inválido en '{col}' del producto {sku}.")
        values["sku"] = sku
        existing = db.scalar(select(Product).where(Product.sku == sku))
        if existing:
            for k, v in values.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(Product(**values))
            created += 1
    db.commit()
    return {"created": created, "updated": updated}
