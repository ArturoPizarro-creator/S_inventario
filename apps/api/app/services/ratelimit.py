"""Límite simple de consultas por ventana de tiempo (en memoria)."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException

_hits: dict[str, deque] = defaultdict(deque)


def limit(key: str, max_calls: int, per_seconds: int, message: str) -> None:
    now = time.time()
    q = _hits[key]
    while q and now - q[0] > per_seconds:
        q.popleft()
    if len(q) >= max_calls:
        raise HTTPException(429, message)
    q.append(now)
