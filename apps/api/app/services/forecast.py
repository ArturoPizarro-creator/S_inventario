"""Predicción de demanda mensual por producto.

- Menos de 6 meses de salidas: no se predice (faltan datos).
- De 6 a 11 meses: promedio móvil de los últimos 3 meses.
- 12 meses o más: XGBoost con rezagos de 3 meses, evaluado con MAE y RMSE
  sobre los últimos meses y comparado contra el promedio móvil.
"""
import math
from functools import lru_cache

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Movement, Product

LAGS = 3
MIN_MONTHS_AVG = 6
MIN_MONTHS_ML = 12


def monthly_series(db: Session, product_id: int) -> pd.Series:
    """Unidades que salieron por mes (demanda), hasta el último mes completo, con ceros en meses sin salidas."""
    rows = db.execute(
        select(Movement.moved_at, Movement.quantity).where(
            Movement.product_id == product_id, Movement.kind == "out"
        )
    ).all()
    if not rows:
        return pd.Series(dtype=float)
    df = pd.DataFrame(rows, columns=["d", "q"])
    df["m"] = pd.to_datetime(df["d"]).dt.to_period("M")
    s = df.groupby("m")["q"].sum()
    end = pd.Timestamp.today().to_period("M") - 1  # el mes en curso está incompleto
    s = s[s.index <= end]
    if s.empty:
        return pd.Series(dtype=float)
    idx = pd.period_range(s.index.min(), end, freq="M")
    return s.reindex(idx, fill_value=0).astype(float)


def _make_xy(y: np.ndarray, months: list[int]):
    X, t = [], []
    for i in range(LAGS, len(y)):
        lag = y[i - LAGS : i]
        X.append([*lag[::-1], lag.mean(), months[i]])
        t.append(y[i])
    return np.array(X, dtype=float), np.array(t, dtype=float)


@lru_cache(maxsize=4096)
def _predict(y_key: tuple, last_ordinal: int, horizon: int):
    """Entrena y predice. Se guarda en caché por serie: si no hay movimientos nuevos no se reentrena."""
    y = np.array(y_key, dtype=float)
    n = len(y)
    last = pd.Period(ordinal=last_ordinal, freq="M")
    future = [last + k for k in range(1, horizon + 1)]
    if n < MIN_MONTHS_ML:
        return "promedio_movil_3m", [float(y[-LAGS:].mean())] * horizon, None

    from xgboost import XGBRegressor

    months = [(last - (n - 1 - i)).month for i in range(n)]
    X, t = _make_xy(y, months)
    n_test = max(3, int(len(t) * 0.2))
    model = XGBRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.9, random_state=42, n_jobs=1)
    model.fit(X[:-n_test], t[:-n_test])
    pred_test = np.clip(model.predict(X[-n_test:]), 0, None)
    err = pred_test - t[-n_test:]
    base_err = X[-n_test:, LAGS] - t[-n_test:]  # promedio móvil de 3 meses
    metrics = {
        "mae": round(float(np.mean(np.abs(err))), 2),
        "rmse": round(float(np.sqrt(np.mean(err**2))), 2),
        "baseline_mae": round(float(np.mean(np.abs(base_err))), 2),
        "test_months": n_test,
    }
    model.fit(X, t)
    hist = list(y)
    preds = []
    for fm in future:
        lag = np.array(hist[-LAGS:])
        row = np.array([[*lag[::-1], lag.mean(), fm.month]], dtype=float)
        p = float(max(0.0, model.predict(row)[0]))
        preds.append(p)
        hist.append(p)
    return "xgboost", preds, metrics


def forecast_product(db: Session, product: Product, horizon: int = 3) -> dict:
    s = monthly_series(db, product.id)
    n = len(s)
    base = {
        "product_id": product.id,
        "sku": product.sku,
        "name": product.name,
        "stock": product.stock,
        "min_stock": product.min_stock,
        "history_months": n,
        "history": [{"month": str(m), "units": float(v)} for m, v in s.tail(12).items()],
    }
    if n < MIN_MONTHS_AVG:
        return {
            **base,
            "method": "sin_datos_suficientes",
            "forecast": [],
            "metrics": None,
            "suggested_order": None,
            "message": f"Se necesitan al menos {MIN_MONTHS_AVG} meses de salidas registradas (hay {n}).",
        }

    last = s.index[-1]
    method, preds, metrics = _predict(tuple(float(v) for v in s.to_numpy()), last.ordinal, horizon)
    future = [last + k for k in range(1, horizon + 1)]
    total = sum(preds)
    return {
        **base,
        "method": method,
        "forecast": [{"month": str(m), "units": round(p, 1)} for m, p in zip(future, preds)],
        "metrics": metrics,
        "suggested_order": max(0, math.ceil(total + product.min_stock - product.stock)),
        "message": None,
    }
