"""Datos del panel de stock (los usan la pantalla y el análisis con IA)."""
from datetime import datetime, timedelta

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from ..models import Movement, Product


def _last_months(n: int) -> list[tuple[int, int]]:
    now = datetime.now()
    y, m = now.year, now.month
    out = []
    for _ in range(n):
        out.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


def get_dashboard(db: Session) -> dict:
    low = db.scalars(select(Product).where(Product.stock <= Product.min_stock).order_by(Product.name)).all()

    months = _last_months(12)
    first = datetime(months[0][0], months[0][1], 1)
    yr, mo = extract("year", Movement.moved_at), extract("month", Movement.moved_at)
    rows = db.execute(
        select(yr, mo, Movement.kind, func.sum(Movement.quantity))
        .where(Movement.moved_at >= first)
        .group_by(yr, mo, Movement.kind)
    ).all()
    acc = {(int(a), int(b), k): int(q) for a, b, k, q in rows}
    monthly = [
        {"month": f"{y}-{m:02d}", "in": acc.get((y, m, "in"), 0), "out": acc.get((y, m, "out"), 0)}
        for y, m in months
    ]

    since = datetime.now() - timedelta(days=30)
    top = db.execute(
        select(Product.name, func.sum(Movement.quantity).label("u"))
        .join(Movement, Movement.product_id == Product.id)
        .where(Movement.kind == "out", Movement.moved_at >= since)
        .group_by(Product.name)
        .order_by(func.sum(Movement.quantity).desc())
        .limit(5)
    ).all()

    return {
        "products_total": db.scalar(select(func.count(Product.id))) or 0,
        "units_in_stock": db.scalar(select(func.coalesce(func.sum(Product.stock), 0))) or 0,
        "movements_total": db.scalar(select(func.count(Movement.id))) or 0,
        "low_stock": [
            {"id": p.id, "sku": p.sku, "name": p.name, "stock": p.stock, "min_stock": p.min_stock} for p in low
        ],
        "monthly": monthly,
        "top_sellers": [{"name": n, "units": int(u)} for n, u in top],
    }
