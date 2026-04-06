import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import List, Dict, Any

analyzer = SentimentIntensityAnalyzer()

def analyze_chat_sentiment(messages: List[str]) -> Dict[str, float]:
    """
    Calculate average sentiment score and volatility (variance).
    Returns dict with 'score' and 'volatility'.
    """
    if not messages:
        return {"score": 0.0, "volatility": 0.0}
    
    scores = []
    pog_words = {"pog": 2.0, "poggers": 2.0, "w": 2.0, "l": -2.0, "hype": 2.0, "omega": 2.0, "kekw": 1.5}
    analyzer.lexicon.update(pog_words)
    
    for msg in messages:
        score = analyzer.polarity_scores(str(msg))
        scores.append(score['compound'])
        
    return {
        "score": float(np.mean(scores)),
        "volatility": float(np.std(scores))
    }

def detect_anomalies(data_points: List[Dict], threshold: float = 2.5) -> List[Dict]:
    """
    Detect anomalies (e.g., raids, botting, viral moments) using Z-score of rate of change.
    """
    if len(data_points) < 5:
        return []
    
    df = pd.DataFrame(data_points)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    # Calculate difference between consecutive polls
    df['diff'] = df['viewer_count'].diff()
    mean_diff = df['diff'].mean()
    std_diff = df['diff'].std()
    
    if pd.isna(std_diff) or std_diff == 0:
        return []
        
    df['z_score'] = (df['diff'] - mean_diff) / std_diff
    anomalies = df[df['z_score'] > threshold]
    
    anomaly_list = []
    for _, row in anomalies.iterrows():
        anomaly_list.append({
            "timestamp": row['timestamp'].isoformat(),
            "viewer_count": row['viewer_count'],
            "z_score": float(row['z_score'])
        })
        
    return anomaly_list

def predict_peak_viewers(data_points: List[Dict]) -> Dict[str, Any]:
    """
    Predict future viewership with Confidence Intervals.
    """
    if len(data_points) < 5:
        return {"status": "insufficient_data"}
        
    df = pd.DataFrame(data_points)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    start_time = df['timestamp'].min()
    df['minutes_since_start'] = (df['timestamp'] - start_time).dt.total_seconds() / 60.0
    
    X = df[['minutes_since_start']].values
    y = df['viewer_count'].values
    
    poly = PolynomialFeatures(degree=2)
    X_poly = poly.fit_transform(X)
    
    model = LinearRegression()
    model.fit(X_poly, y)
    
    # Calculate Mean Squared Error for Confidence Intervals
    y_pred_past = model.predict(X_poly)
    mse = np.mean((y - y_pred_past) ** 2)
    std_error = np.sqrt(mse)
    
    # Predict for the next 30 minutes in 5-min intervals
    last_minute = df['minutes_since_start'].max()
    future_minutes_arr = [last_minute + i for i in range(5, 35, 5)]
    future_minutes = np.array([[m] for m in future_minutes_arr])
    future_poly = poly.transform(future_minutes)
    
    predictions = model.predict(future_poly)
    
    # 95% confidence interval multiplier is approx 1.96
    z_score_95 = 1.96
    margin_of_error = z_score_95 * std_error
    
    forecast = []
    for i, m in enumerate(future_minutes_arr):
        pred_val = int(predictions[i])
        forecast.append({
            "minute_offset": int(m - last_minute),
            "predicted_viewers": max(0, pred_val),
            "upper_bound": max(0, int(pred_val + margin_of_error)),
            "lower_bound": max(0, int(max(0, pred_val - margin_of_error)))
        })
        
    predicted_peak = max(int(np.max(predictions)), int(y.max()))
    
    current = y[-1]
    last_pred = predictions[-1]
    if last_pred > current * 1.05:
        trend = "growing"
    elif last_pred < current * 0.95:
        trend = "declining"
    else:
        trend = "stable"
        
    anomalies = detect_anomalies(data_points)
        
    return {
        "status": "success",
        "predicted_peak": predicted_peak,
        "trend": trend,
        "current_viewers": int(current),
        "forecast": forecast,
        "anomalies_detected": len(anomalies) > 0,
        "anomalies": anomalies,
        "model_std_error": float(std_error)
    }

def calculate_similarity(streamer_a_data: Dict, streamer_b_data: Dict) -> Dict[str, Any]:
    """
    Calculate similarity score between two streamers based on categories and viewer scale.
    """
    cats_a = set(c['name'] for c in streamer_a_data.get('category_breakdown', []))
    cats_b = set(c['name'] for c in streamer_b_data.get('category_breakdown', []))
    
    if not cats_a or not cats_b:
        category_sim = 0.0
    else:
        intersection = cats_a.intersection(cats_b)
        union = cats_a.union(cats_b)
        category_sim = len(intersection) / len(union)
        
    peak_a = streamer_a_data.get('best_peak_viewers', 1)
    peak_b = streamer_b_data.get('best_peak_viewers', 1)
    
    # Scale similarity (how close are they in size)
    scale_sim = 1.0 - min(1.0, abs(np.log10(max(1, peak_a)) - np.log10(max(1, peak_b))) / 5.0)
    
    total_sim = (category_sim * 0.6) + (scale_sim * 0.4)
    
    return {
        "score": round(total_sim * 100, 1),
        "category_overlap": list(cats_a.intersection(cats_b)),
        "scale_match": round(scale_sim * 100, 1)
    }

def get_streamer_archetype(analytics: Dict) -> Dict[str, str]:
    """
    Determine the streamer's 'Archetype' based on their behavioral data.
    """
    avg_duration = analytics.get('avg_duration_minutes', 0)
    consistency = analytics.get('consistency_score', 0)
    peak = analytics.get('best_peak_viewers', 0)
    hourly = analytics.get('hourly_activity', [0]*24)
    
    # Night Owl check (majority of streams between 10PM and 4AM)
    night_hours = sum(hourly[22:] + hourly[:5])
    total_hours = sum(hourly) or 1
    is_night_owl = (night_hours / total_hours) > 0.6
    
    if peak > 100000:
        return {"id": "titan", "name": "Streaming Titan", "desc": "A dominant force in the industry with massive reach."}
    if avg_duration > 480:
        return {"id": "marathon", "name": "Marathon Runner", "desc": "Known for incredibly long, high-endurance sessions."}
    if consistency > 85:
        return {"id": "clockwork", "name": "Clockwork Creator", "desc": "Extremely reliable schedule. Fans always know when to tune in."}
    if is_night_owl:
        return {"id": "nightowl", "name": "Night Owl", "desc": "Thrives in the late-night and early-morning hours."}
    if len(analytics.get('category_breakdown', [])) > 10:
        return {"id": "polymath", "name": "Variety Polymath", "desc": "Master of many games and categories."}
        
    return {"id": "rising", "name": "Rising Star", "desc": "Building a unique community and consistent presence."}

if __name__ == "__main__":
    # Test
    msgs = ["W stream", "this is so boring L", "POGGERS POG POG", "hello guys"]
    print(f"Test sentiment: {analyze_chat_sentiment(msgs)}")

