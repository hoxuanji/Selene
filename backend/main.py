from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
from datetime import datetime
from dateutil.parser import parse
import torch
import torch.nn as nn
import os
import json

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


# Baseline prediction functions
def diff_between_dates(dates: List[str]) -> List[int]:
    """Calculate cycle lengths (days between consecutive dates)."""
    if len(dates) < 2:
        return []
    
    sorted_dates = sorted([parse(d).date() for d in dates])
    cycles = []
    for i in range(1, len(sorted_dates)):
        delta = (sorted_dates[i] - sorted_dates[i-1]).days
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
        # Not enough data
        return None, None, 0.0
    
    avg_cycle = weighted_average(cycles)
    std_dev = float(np.std(cycles)) if len(cycles) > 1 else 0.0
    
    # Last date
    sorted_dates = sorted([parse(d).date() for d in dates])
    last_date = sorted_dates[-1]
    
    # Predict range
    earliest_days = int(avg_cycle - std_dev) if std_dev > 0 else int(avg_cycle) - 2
    latest_days = int(avg_cycle + std_dev) if std_dev > 0 else int(avg_cycle) + 2
    
    earliest_days = max(20, earliest_days)  # Reasonable minimum
    latest_days = min(40, latest_days)      # Reasonable maximum
    
    from datetime import timedelta
    earliest = (last_date + timedelta(days=earliest_days)).isoformat()
    latest = (last_date + timedelta(days=latest_days)).isoformat()
    
    # Confidence: inverse of coefficient of variation
    if avg_cycle > 0:
        cv = (std_dev / avg_cycle) if std_dev > 0 else 0.0
        confidence = min(0.95, 1.0 - min(0.5, cv / 2.0))
    else:
        confidence = 0.0
    
    return earliest, latest, confidence


# LSTM Model
class LSTMCyclePredictor(nn.Module):
    def __init__(self, input_size=1, hidden_size=32, num_layers=2):
        super(LSTMCyclePredictor, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)
    
    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_out = lstm_out[:, -1, :]
        pred = self.fc(last_out)
        return pred


MODEL_PATH = "cycle_model.pth"
model = None

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = LSTMCyclePredictor()
        model.load_state_dict(torch.load(MODEL_PATH))
        model.eval()
    else:
        model = LSTMCyclePredictor()

load_model()


def lstm_predict(dates: List[str]) -> float:
    """Predict next cycle length using LSTM."""
    global model
    
    cycles = diff_between_dates(dates)
    if len(cycles) < 3:
        return weighted_average(cycles)
    
    try:
        # Prepare input
        x = torch.tensor(cycles[-10:], dtype=torch.float32).reshape(-1, 1, 1)
        with torch.no_grad():
            pred = model(x)
        return max(20.0, min(40.0, float(pred.item())))
    except:
        return weighted_average(cycles)


def baseline_predict(dates: List[str]) -> tuple:
    """Baseline prediction without LSTM."""
    return predict_range(dates)


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """Predict next period dates."""
    if len(request.dates) < 5:
        earliest, latest, confidence = baseline_predict(request.dates)
    else:
        cycles = diff_between_dates(request.dates)
        avg_cycle = weighted_average(cycles)
        lstm_cycle = lstm_predict(request.dates)
        # Blend predictions
        predicted_cycle = (avg_cycle + lstm_cycle) / 2
        
        sorted_dates = sorted([parse(d).date() for d in request.dates])
        last_date = sorted_dates[-1]
        
        from datetime import timedelta
        std_dev = float(np.std(cycles)) if len(cycles) > 1 else 0.0
        earliest_days = max(20, int(predicted_cycle - std_dev))
        latest_days = min(40, int(predicted_cycle + std_dev))
        
        earliest = (last_date + timedelta(days=earliest_days)).isoformat()
        latest = (last_date + timedelta(days=latest_days)).isoformat()
        
        if avg_cycle > 0:
            cv = (std_dev / avg_cycle) if std_dev > 0 else 0.0
            confidence = min(0.95, 1.0 - min(0.5, cv / 2.0))
        else:
            confidence = 0.0
    
    return PredictResponse(
        earliest=earliest,
        latest=latest,
        confidence=confidence
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
