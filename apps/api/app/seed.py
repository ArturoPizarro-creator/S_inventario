"""Datos DE PRUEBA para ver el sistema funcionando. NO son datos reales de la empresa.

Uso: python -m app.seed
"""
import random
from datetime import datetime, timedelta

from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import Movement, Product

# (sku, nombre, categoría, salidas base por mes, stock mínimo)
PRODUCTS = [
    ("CAS-001", "Casco integral", "Cascos", 28, 60),
    ("GUA-001", "Guantes de cuero", "Indumentaria", 3, 80),
    ("CHA-001", "Chaqueta con protecciones", "Indumentaria", 10, 30),
    ("INT-001", "Intercomunicador Bluetooth", "Accesorios", 15, 40),
    ("BAU-001", "Baúl trasero 45 L", "Accesorios", 20, 25),
    ("ESP-001", "Espejos retrovisores (par)", "Repuestos", 40, 50),
    ("CAD-001", "Kit de arrastre", "Repuestos", 25, 35),
    ("LUC-001", "Luces LED auxiliares", "Accesorios", 18, 45),
]


def main():
    Base.metadata.create_all(engine)
    random.seed(7)
    with SessionLocal() as db:
        if db.scalar(select(Product.id).limit(1)):
            print("Ya hay productos; no se cargó nada.")
            return
        today = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)
        for sku, name, cat, base_qty, min_stock in PRODUCTS:
            p = Product(sku=sku, name=name, category=cat, stock=0, min_stock=min_stock)
            db.add(p)
            db.flush()
            total_out = 0
            for m in range(30, 0, -1):
                month_start = today.replace(day=1) - timedelta(days=30 * m)
                season = 1.35 if month_start.month in (11, 12, 1) else 1.0
                qty = max(0, int(random.gauss(base_qty * season, base_qty * 0.2)))
                n_moves = max(1, qty // 4)
                for _ in range(n_moves):
                    q = max(1, qty // n_moves)
                    day = month_start + timedelta(days=random.randint(0, 27))
                    db.add(Movement(product_id=p.id, kind="out", quantity=q, moved_at=day, note="Salida (demo)"))
                    total_out += q
            p.stock = max(0, int(base_qty * random.choice([0.4, 1.2, 2.5])))
            db.add(Movement(product_id=p.id, kind="in", quantity=p.stock + total_out,
                            moved_at=today - timedelta(days=1000), note="Carga inicial (demo)"))
        db.commit()
        print("Datos de prueba cargados.")


if __name__ == "__main__":
    main()
