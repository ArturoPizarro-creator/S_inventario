"""Lectura segura de archivos subidos (Excel/CSV): tamaño, tipo, «bombas zip» y número de filas."""
import io
import zipfile

import pandas as pd
from fastapi import HTTPException, UploadFile

from ..config import settings

MAX_ROWS = 50_000
MAX_UNZIPPED_MB = 100  # un .xlsx es un zip: se limita lo que ocupa descomprimido


def load_table(file: UploadFile) -> pd.DataFrame:
    name = (file.filename or "").lower()
    if not name.endswith((".csv", ".xlsx")):
        raise HTTPException(400, "Usa un archivo .xlsx o .csv.")

    limit = settings.max_upload_mb * 1024 * 1024
    raw = file.file.read(limit + 1)
    if len(raw) > limit:
        raise HTTPException(413, f"El archivo supera el máximo de {settings.max_upload_mb} MB.")
    if not raw:
        raise HTTPException(400, "El archivo está vacío.")

    try:
        if name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw))
        else:
            if not zipfile.is_zipfile(io.BytesIO(raw)):
                raise HTTPException(400, "El archivo no es un .xlsx válido.")
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                if sum(i.file_size for i in z.infolist()) > MAX_UNZIPPED_MB * 1024 * 1024:
                    raise HTTPException(413, "El archivo ocupa demasiado al descomprimirse.")
            df = pd.read_excel(io.BytesIO(raw))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "No se pudo leer el archivo. Usa un .xlsx o .csv.")

    if len(df) > MAX_ROWS:
        raise HTTPException(413, f"El archivo tiene demasiadas filas (máximo {MAX_ROWS:,}). Divídelo en partes.")
    return df
