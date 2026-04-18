from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()


def analyze_chat_sentiment(messages: list[str]) -> dict[str, float]:
    if not messages:
        return {"score": 0.0, "volatility": 0.0}

    analyzer.lexicon.update(
        {
            "pog": 2.0,
            "poggers": 2.0,
            "w": 2.0,
            "l": -2.0,
            "hype": 2.0,
            "omega": 2.0,
            "kekw": 1.5,
        }
    )

    scores = [analyzer.polarity_scores(str(message))["compound"] for message in messages]
    return {
        "score": float(np.mean(scores)),
        "volatility": float(np.std(scores)),
    }


def detect_anomalies(data_points: list[dict[str, Any]], threshold: float = 2.5) -> list[dict[str, Any]]:
    if len(data_points) < 5:
        return []

    frame = pd.DataFrame(data_points)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"])
    frame = frame.sort_values("timestamp")
    frame["diff"] = frame["viewer_count"].diff()

    mean_diff = frame["diff"].mean()
    std_diff = frame["diff"].std()
    if pd.isna(std_diff) or std_diff == 0:
        return []

    frame["z_score"] = (frame["diff"] - mean_diff) / std_diff
    anomalies = frame[frame["z_score"] > threshold]

    return [
        {
            "timestamp": row["timestamp"].isoformat(),
            "viewer_count": int(row["viewer_count"]),
            "z_score": float(row["z_score"]),
        }
        for _, row in anomalies.iterrows()
    ]


def _confidence_label(std_error: float, current_viewers: int, model_mae: float, naive_mae: float) -> str:
    relative_error = std_error / max(current_viewers, 1)
    beats_baseline = model_mae <= naive_mae

    if relative_error < 0.12 and beats_baseline:
        return "high"
    if relative_error < 0.28:
        return "medium"
    return "low"


def predict_peak_viewers(data_points: list[dict[str, Any]]) -> dict[str, Any]:
    if len(data_points) < 5:
        return {"status": "insufficient_data"}

    frame = pd.DataFrame(data_points)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"])
    frame = frame.sort_values("timestamp")

    start_time = frame["timestamp"].min()
    frame["minutes_since_start"] = (frame["timestamp"] - start_time).dt.total_seconds() / 60.0

    x = frame[["minutes_since_start"]].values
    y = frame["viewer_count"].astype(float).values

    poly = PolynomialFeatures(degree=2)
    x_poly = poly.fit_transform(x)

    model = LinearRegression()
    model.fit(x_poly, y)

    historical_prediction = model.predict(x_poly)
    model_mae = float(np.mean(np.abs(y - historical_prediction)))
    mse = float(np.mean((y - historical_prediction) ** 2))
    std_error = float(np.sqrt(mse))

    naive_prediction = np.roll(y, 1)
    naive_prediction[0] = y[0]
    naive_mae = float(np.mean(np.abs(y[1:] - naive_prediction[1:]))) if len(y) > 1 else model_mae

    last_minute = float(frame["minutes_since_start"].max())
    future_minutes_arr = [last_minute + step for step in range(5, 35, 5)]
    future_minutes = np.array([[minute] for minute in future_minutes_arr])
    future_poly = poly.transform(future_minutes)
    predictions = model.predict(future_poly)

    margin_of_error = 1.96 * std_error
    forecast = []
    for index, minute in enumerate(future_minutes_arr):
        predicted_value = int(predictions[index])
        forecast.append(
            {
                "minute_offset": int(minute - last_minute),
                "predicted_viewers": max(0, predicted_value),
                "upper_bound": max(0, int(predicted_value + margin_of_error)),
                "lower_bound": max(0, int(max(0, predicted_value - margin_of_error))),
            }
        )

    current = int(y[-1])
    last_prediction = float(predictions[-1])
    if last_prediction > current * 1.05:
        trend = "growing"
    elif last_prediction < current * 0.95:
        trend = "declining"
    else:
        trend = "stable"

    anomalies = detect_anomalies(data_points)
    confidence_label = _confidence_label(std_error, current, model_mae, naive_mae)

    return {
        "status": "success",
        "predicted_peak": max(int(np.max(predictions)), int(y.max())),
        "baseline_peak": int(current),
        "trend": trend,
        "current_viewers": current,
        "forecast": forecast,
        "anomalies_detected": len(anomalies) > 0,
        "anomalies": anomalies,
        "model_std_error": std_error,
        "model_mae": model_mae,
        "baseline_mae": naive_mae,
        "confidence_label": confidence_label,
        "samples_used": int(len(y)),
    }
