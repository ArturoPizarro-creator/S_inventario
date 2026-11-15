import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Product
from ..services.forecast import forecast_product

log = logging.getLogger("fargoz")
router = APIRouter(prefix="/forecast", tags=["predicción"])


@router.get("/restock/all")
def restock(horizon: int = Query(3, ge=1, le=6), db: Session = Depends(get_db)):
    """Reposición sugerida de todos los productos (los que tienen datos suficientes), de mayor a menor."""
    items = []
    for p in db.scalars(select(Product).order_by(Product.name)).all():
        try:
            f = forecast_product(db, p, horizon)
        except Exception:  # un producto con datos raros no debe tumbar toda la pantalla
            log.exception("Falló la predicción del producto %s", p.sku)
            f = {"method": "error", "history_months": 0, "forecast": [], "suggested_order": None}
        items.append(
            {
                "product_id": p.id, "sku": p.sku, "name": p.name, "category": p.category,
                "stock": p.stock, "min_stock": p.min_stock, "method": f["method"],
                "history_months": f["history_months"],
                "expected_demand": round(sum(x["units"] for x in f["forecast"]), 1) if f["forecast"] else None,
                "suggested_order": f["suggested_order"],
            }
        )
    items.sort(key=lambda i: (i["suggested_order"] is None, -(i["suggested_order"] or 0)))
    return items


@router.get("/{product_id}")
def get_forecast(product_id: int, horizon: int = Query(3, ge=1, le=6), db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado.")
    return forecast_product(db, product, horizon)
