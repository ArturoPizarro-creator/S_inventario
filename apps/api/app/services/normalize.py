"""Limpieza de valores leídos desde Excel/CSV."""
import pandas as pd


def clean_sku(value) -> str:
    """SKU como texto. Un 1001 numérico que Excel/pandas lee como 1001.0 vuelve a ser '1001'."""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def is_blank(value) -> bool:
    return value is None or (not isinstance(value, str) and pd.isna(value)) or str(value).strip() == ""
