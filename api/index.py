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
    predicted_date: str
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
    Predict next period with an exact date and ±1 day range.
    Returns (predicted_date, earliest, latest, confidence)
    """
    cycles = diff_between_dates(dates)

    if not cycles:
        return None, None, None, 0.0

    avg_cycle = weighted_average(cycles)
    std_dev = float(np.std(cycles)) if len(cycles) > 1 else 0.0

    sorted_dates = sorted([parse(d).date() for d in dates])
    last_date = sorted_dates[-1]

    # Predict exact date using the weighted average cycle length
    predicted_days = round(avg_cycle)
    predicted_days = max(20, min(40, predicted_days))
    predicted_date = last_date + timedelta(days=predicted_days)

    # ±1 day window around the predicted date
    earliest = (predicted_date - timedelta(days=1)).isoformat()
    latest = (predicted_date + timedelta(days=1)).isoformat()

    if avg_cycle > 0:
        cv = (std_dev / avg_cycle) if std_dev > 0 else 0.0
        confidence = min(0.95, 1.0 - min(0.5, cv / 2.0))
    else:
        confidence = 0.0

    return predicted_date.isoformat(), earliest, latest, confidence


@app.post("/api/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """Predict next period dates."""
    predicted_date, earliest, latest, confidence = predict_range(request.dates)
    return PredictResponse(
        predicted_date=predicted_date or "",
        earliest=earliest or "",
        latest=latest or "",
        confidence=confidence,
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}
