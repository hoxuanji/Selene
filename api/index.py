from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
from datetime import datetime, timedelta
from dateutil.parser import parse

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    dates: List[str]


class PredictResponse(BaseModel):
    earliest: str
    latest: str
    confidence: float


def diff_between_dates(dates: List[str]) -> List[int]:
    """Calculate cycle lengths (days between consecutive dates)."""
    if len(dates) < 2:
        return []

    sorted_dates = sorted([parse(d).date() for d in dates])
    cycles = []
    for i in range(1, len(sorted_dates)):
        delta = (sorted_dates[i] - sorted_dates[i - 1]).days
        cycles.append(delta)
    return cycles


def weighted_average(cycles: List[int]) -> float:
    """Calculate weighted average giving more weight to recent cycles."""
    if not cycles:
        return 28.0  # Default cycle length

    weights = np.linspace(1, len(cycles), len(cycles))
    weighted_sum = sum(c * w for c, w in zip(cycles, weights))
    return weighted_sum / sum(weights)


def predict_range(dates: List[str]) -> tuple:
    """
    Predict next period range.
    Returns (earliest, latest, confidence)
    """
    cycles = diff_between_dates(dates)

    if not cycles:
        return None, None, 0.0

    avg_cycle = weighted_average(cycles)
    std_dev = float(np.std(cycles)) if len(cycles) > 1 else 0.0

    sorted_dates = sorted([parse(d).date() for d in dates])
    last_date = sorted_dates[-1]

    earliest_days = int(avg_cycle - std_dev) if std_dev > 0 else int(avg_cycle) - 2
    latest_days = int(avg_cycle + std_dev) if std_dev > 0 else int(avg_cycle) + 2

    earliest_days = max(20, earliest_days)
    latest_days = min(40, latest_days)

    earliest = (last_date + timedelta(days=earliest_days)).isoformat()
    latest = (last_date + timedelta(days=latest_days)).isoformat()

    if avg_cycle > 0:
        cv = (std_dev / avg_cycle) if std_dev > 0 else 0.0
        confidence = min(0.95, 1.0 - min(0.5, cv / 2.0))
    else:
        confidence = 0.0

    return earliest, latest, confidence


@app.post("/api/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """Predict next period dates."""
    earliest, latest, confidence = predict_range(request.dates)
    return PredictResponse(
        earliest=earliest or "",
        latest=latest or "",
        confidence=confidence,
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}
