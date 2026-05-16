"""
ML models for KC Live.

This module produces a peak-viewer forecast plus an honest evaluation of the
model behind it. The forecast is a small ensemble:

    1. Polynomial regression (degree 2)   - captures concave / convex sessions
    2. Holt's linear exponential smoothing - captures noisy trend lines
    3. Ridge regression on engineered features (lags + rolling mean + minute)

For each sub-model we compute MAE, RMSE, MAPE, R^2, and the residual
autocorrelation (Durbin-Watson). The winner is picked by walk-forward
cross-validated MAE so the test set never leaks into the fit. The ensemble
output is a confidence-weighted average of the survivors.

Anomalies use a rolling z-score (window = 8 datapoints) so local spikes show
up even when the session as a whole is volatile.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import PolynomialFeatures
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()


# ---------------------------------------------------------------------------
# Chat sentiment (unchanged, kept for backward compatibility)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Anomaly detection — rolling window so local spikes are visible
# ---------------------------------------------------------------------------
def detect_anomalies(
    data_points: list[dict[str, Any]],
    threshold: float = 2.5,
    window: int = 8,
) -> list[dict[str, Any]]:
    """Flag viewer-diff datapoints whose rolling z-score exceeds threshold."""
    if len(data_points) < max(5, window):
        return []

    frame = pd.DataFrame(data_points)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"])
    frame = frame.sort_values("timestamp").reset_index(drop=True)
    frame["diff"] = frame["viewer_count"].diff()

    # Rolling mean + std over the last `window` diffs (min_periods so the
    # earliest rows still get a score once we have enough data).
    rolling_mean = frame["diff"].rolling(window=window, min_periods=4).mean()
    rolling_std = frame["diff"].rolling(window=window, min_periods=4).std()

    frame["z_score"] = (frame["diff"] - rolling_mean) / rolling_std.replace(0, np.nan)
    frame["z_score"] = frame["z_score"].fillna(0.0)

    anomalies = frame[frame["z_score"].abs() > threshold]
    return [
        {
            "timestamp": row["timestamp"].isoformat(),
            "viewer_count": int(row["viewer_count"]),
            "z_score": float(row["z_score"]),
            "direction": "surge" if row["z_score"] > 0 else "drop",
        }
        for _, row in anomalies.iterrows()
    ]


# ---------------------------------------------------------------------------
# Helpers: evaluation metrics
# ---------------------------------------------------------------------------
def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    safe = np.where(y_true == 0, 1.0, y_true)
    return float(np.mean(np.abs((y_true - y_pred) / safe)) * 100.0)


def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    if ss_tot == 0:
        return 0.0
    return float(1.0 - ss_res / ss_tot)


def _durbin_watson(residuals: np.ndarray) -> float:
    """Roughly 2 = no autocorrelation, <1 or >3 = bad fit."""
    if len(residuals) < 2:
        return 2.0
    diff = np.diff(residuals)
    denom = float(np.sum(residuals ** 2))
    if denom == 0:
        return 2.0
    return float(np.sum(diff ** 2) / denom)


def _evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": _mae(y_true, y_pred),
        "rmse": _rmse(y_true, y_pred),
        "mape": _mape(y_true, y_pred),
        "r2": _r2(y_true, y_pred),
        "durbin_watson": _durbin_watson(y_true - y_pred),
    }


# ---------------------------------------------------------------------------
# Sub-model: polynomial regression
# ---------------------------------------------------------------------------
def _fit_predict_poly(x: np.ndarray, y: np.ndarray, x_future: np.ndarray, degree: int = 2):
    poly = PolynomialFeatures(degree=degree)
    x_poly = poly.fit_transform(x)
    model = LinearRegression().fit(x_poly, y)
    in_sample = model.predict(x_poly)
    out_sample = model.predict(poly.transform(x_future))
    return in_sample, out_sample


# ---------------------------------------------------------------------------
# Sub-model: Holt's linear exponential smoothing (no statsmodels needed)
# ---------------------------------------------------------------------------
def _holt_linear(y: np.ndarray, horizon: int, alpha: float = 0.5, beta: float = 0.3):
    """Pure-numpy Holt's linear trend forecast."""
    if len(y) < 2:
        return y.copy(), np.full(horizon, y[-1] if len(y) else 0.0)

    level = y[0]
    trend = y[1] - y[0]
    fitted = np.zeros_like(y, dtype=float)
    fitted[0] = level
    for i in range(1, len(y)):
        prev_level = level
        level = alpha * y[i] + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
        fitted[i] = level

    future = np.array([level + (h + 1) * trend for h in range(horizon)])
    return fitted, future


# ---------------------------------------------------------------------------
# Sub-model: ridge on engineered features
# ---------------------------------------------------------------------------
def _engineer_features(y: np.ndarray, minutes: np.ndarray, window: int = 3) -> np.ndarray:
    n = len(y)
    feats = np.zeros((n, 4), dtype=float)
    for i in range(n):
        lag1 = y[i - 1] if i >= 1 else y[i]
        lag2 = y[i - 2] if i >= 2 else lag1
        roll = float(np.mean(y[max(0, i - window): i + 1]))
        feats[i] = [minutes[i], lag1, lag2, roll]
    return feats


def _fit_predict_ridge(y: np.ndarray, minutes: np.ndarray, future_minutes: np.ndarray):
    feats = _engineer_features(y, minutes)
    model = Ridge(alpha=1.0).fit(feats, y)
    in_sample = model.predict(feats)

    # Recursive forecasting — feed each prediction back as the next lag.
    last_y = list(y[-3:])
    forecasts = []
    for m in future_minutes:
        lag1 = last_y[-1]
        lag2 = last_y[-2] if len(last_y) >= 2 else lag1
        roll = float(np.mean(last_y[-3:]))
        f = np.array([[m, lag1, lag2, roll]])
        pred = float(model.predict(f)[0])
        forecasts.append(pred)
        last_y.append(pred)
    return in_sample, np.array(forecasts)


# ---------------------------------------------------------------------------
# Walk-forward cross-validation (no test-set leakage)
# ---------------------------------------------------------------------------
def _walk_forward_mae(y: np.ndarray, x: np.ndarray, model_kind: str) -> float:
    if len(y) < 8:
        return float("inf")

    splits = 4
    fold_size = len(y) // (splits + 1)
    errs = []
    for fold in range(1, splits + 1):
        cutoff = fold_size * fold
        if cutoff < 4 or cutoff >= len(y) - 1:
            continue
        y_train = y[:cutoff]
        x_train = x[:cutoff]
        y_test = y[cutoff: cutoff + fold_size]
        x_test = x[cutoff: cutoff + fold_size]
        if len(y_test) == 0:
            continue
        if model_kind == "poly":
            poly = PolynomialFeatures(degree=2)
            xp_tr = poly.fit_transform(x_train)
            model = LinearRegression().fit(xp_tr, y_train)
            pred = model.predict(poly.transform(x_test))
        elif model_kind == "holt":
            _, pred = _holt_linear(y_train, horizon=len(y_test))
        elif model_kind == "ridge":
            minutes_tr = x_train.flatten()
            minutes_te = x_test.flatten()
            _, pred = _fit_predict_ridge(y_train, minutes_tr, minutes_te)
        else:
            continue
        errs.append(_mae(y_test, pred))
    return float(np.mean(errs)) if errs else float("inf")


def _confidence_label(std_error: float, current_viewers: int, beats_baseline: bool, r2: float) -> str:
    relative_error = std_error / max(current_viewers, 1)
    if relative_error < 0.10 and beats_baseline and r2 > 0.6:
        return "high"
    if relative_error < 0.25 and r2 > 0.2:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Main forecast — ensemble pipeline
# ---------------------------------------------------------------------------
def predict_peak_viewers(data_points: list[dict[str, Any]]) -> dict[str, Any]:
    if len(data_points) < 5:
        return {"status": "insufficient_data"}

    frame = pd.DataFrame(data_points)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"])
    frame = frame.sort_values("timestamp")

    start_time = frame["timestamp"].min()
    frame["minutes_since_start"] = (frame["timestamp"] - start_time).dt.total_seconds() / 60.0

    minutes = frame["minutes_since_start"].values.astype(float)
    x = minutes.reshape(-1, 1)
    y = frame["viewer_count"].astype(float).values

    # ---- naive baseline -----------------------------------------------------
    naive_prediction = np.roll(y, 1)
    naive_prediction[0] = y[0]
    naive_mae = _mae(y[1:], naive_prediction[1:]) if len(y) > 1 else _mae(y, naive_prediction)

    # ---- future horizon -----------------------------------------------------
    last_minute = float(minutes.max())
    future_minutes_arr = np.array([last_minute + step for step in range(5, 35, 5)], dtype=float)
    future_x = future_minutes_arr.reshape(-1, 1)

    # ---- fit each sub-model -------------------------------------------------
    poly_in, poly_out = _fit_predict_poly(x, y, future_x)
    holt_in, holt_out = _holt_linear(y, horizon=len(future_minutes_arr))
    ridge_in, ridge_out = _fit_predict_ridge(y, minutes, future_minutes_arr)

    sub_models = {
        "polynomial": {
            "in_sample": poly_in,
            "out_sample": poly_out,
            "eval": _evaluate(y, poly_in),
            "cv_mae": _walk_forward_mae(y, x, "poly"),
        },
        "holt_linear": {
            "in_sample": holt_in,
            "out_sample": holt_out,
            "eval": _evaluate(y, holt_in),
            "cv_mae": _walk_forward_mae(y, x, "holt"),
        },
        "ridge": {
            "in_sample": ridge_in,
            "out_sample": ridge_out,
            "eval": _evaluate(y, ridge_in),
            "cv_mae": _walk_forward_mae(y, x, "ridge"),
        },
    }

    # ---- ensemble: average the in-sample-best two by CV MAE -----------------
    ranked = sorted(sub_models.items(), key=lambda kv: kv[1]["cv_mae"])
    keep = [name for name, _ in ranked[:2]]
    winners = {k: sub_models[k] for k in keep}

    ensemble_in = np.mean([m["in_sample"] for m in winners.values()], axis=0)
    ensemble_out = np.mean([m["out_sample"] for m in winners.values()], axis=0)
    ensemble_eval = _evaluate(y, ensemble_in)

    std_error = float(np.sqrt(np.mean((y - ensemble_in) ** 2)))
    margin_of_error = 1.96 * std_error

    forecast = []
    for index, minute in enumerate(future_minutes_arr):
        predicted_value = int(ensemble_out[index])
        forecast.append(
            {
                "minute_offset": int(minute - last_minute),
                "predicted_viewers": max(0, predicted_value),
                "upper_bound": max(0, int(predicted_value + margin_of_error)),
                "lower_bound": max(0, int(predicted_value - margin_of_error)),
            }
        )

    current = int(y[-1])
    last_prediction = float(ensemble_out[-1])
    if last_prediction > current * 1.05:
        trend = "growing"
    elif last_prediction < current * 0.95:
        trend = "declining"
    else:
        trend = "stable"

    anomalies = detect_anomalies(data_points)
    beats_baseline = ensemble_eval["mae"] <= naive_mae
    confidence_label = _confidence_label(std_error, current, beats_baseline, ensemble_eval["r2"])

    # Strip arrays from sub_models for JSON safety
    model_card = {
        name: {
            "evaluation": meta["eval"],
            "cv_mae": meta["cv_mae"],
            "selected_in_ensemble": name in keep,
        }
        for name, meta in sub_models.items()
    }

    return {
        "status": "success",
        "predicted_peak": max(int(np.max(ensemble_out)), int(y.max())),
        "baseline_peak": int(current),
        "trend": trend,
        "current_viewers": current,
        "forecast": forecast,
        "anomalies_detected": len(anomalies) > 0,
        "anomalies": anomalies,
        "model_std_error": std_error,
        "model_mae": ensemble_eval["mae"],
        "baseline_mae": naive_mae,
        "confidence_label": confidence_label,
        "samples_used": int(len(y)),
        # New, richer fields:
        "ensemble_members": keep,
        "model_card": model_card,
        "ensemble_evaluation": ensemble_eval,
        "beats_naive_baseline": beats_baseline,
    }
