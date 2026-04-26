from __future__ import annotations

import copy
import json
import logging
import os
import re
import secrets
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory

try:
    from .database import get_recent_snapshots, log_chat_sentiment, log_stream_snapshot
    from .ml_models import analyze_chat_sentiment, predict_peak_viewers

    ML_AVAILABLE = True
except ImportError:
    try:
        from database import get_recent_snapshots, log_chat_sentiment, log_stream_snapshot
        from ml_models import analyze_chat_sentiment, predict_peak_viewers

        ML_AVAILABLE = True
    except ImportError:
        ML_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent.parent
PACKAGE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
CONFIG_PATH = PACKAGE_DIR / "config.json"
SAMPLE_CONFIG_PATH = PACKAGE_DIR / "config.sample.json"
DATA_DIR = BASE_DIR / "data"
STATE_PATH = DATA_DIR / "stream_state.json"

DEFAULT_TIMEOUT = 12
TWITCH_OAUTH_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_API_BASE = "https://api.twitch.tv/helix"
DEFAULT_ALERT_THRESHOLDS = [1000, 5000, 10000, 25000, 50000, 100000]
DEFAULT_STREAMERS = [
    "kaicenat",
    "pokimane",
    "caseoh_",
    "fanum",
    "tarik",
    "hasanabi",
    "shroud",
    "xqc",
    "mizkif",
    "nmplol",
    "asmongold",
    "lirik",
]
DEFAULT_GROUPS = {
    "AMP": ["kaicenat", "fanum"],
    "Creators": ["pokimane", "hasanabi", "mizkif", "nmplol"],
    "FPS": ["tarik", "shroud", "xqc"],
    "Variety": ["caseoh_", "asmongold", "lirik"],
}
LOGIN_RE = re.compile(r"^[a-z0-9_]{3,25}$")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def format_minutes(minutes: int) -> str:
    hours, mins = divmod(max(minutes, 0), 60)
    if hours >= 24:
        days, rem_hours = divmod(hours, 24)
        return f"{days}d {rem_hours}h {mins}m"
    if hours:
        return f"{hours}h {mins}m"
    return f"{mins}m"


def format_uptime(started_at: str | None) -> str:
    started = parse_timestamp(started_at)
    if not started:
        return "Offline"
    elapsed = utc_now() - started
    return format_minutes(int(elapsed.total_seconds() // 60))


def duration_minutes(started_at: str | None, ended_at: str | None = None) -> int:
    start = parse_timestamp(started_at)
    end = parse_timestamp(ended_at) if ended_at else utc_now()
    if not start or not end:
        return 0
    return max(int((end - start).total_seconds() // 60), 0)


def flatten_thumbnail(url: str | None, width: int = 640, height: int = 360) -> str:
    if not url:
        return ""
    return url.replace("{width}", str(width)).replace("{height}", str(height))


def load_json_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def load_dotenv_candidates() -> None:
    candidates = [BASE_DIR / ".env", BASE_DIR.parent / ".env", Path.cwd() / ".env"]
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if candidate.exists():
            load_dotenv(candidate, override=False)


def parse_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_login(value: Any) -> str:
    login = str(value or "").strip().lower().lstrip("@")
    return login if LOGIN_RE.fullmatch(login) else ""


def parse_streamers(raw: str | list[str] | None) -> list[str]:
    if raw is None:
        return DEFAULT_STREAMERS.copy()
    items = raw if isinstance(raw, list) else [item.strip() for item in str(raw).split(",")]
    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        login = normalize_login(item)
        if login and login not in seen:
            seen.add(login)
            normalized.append(login)
    return normalized or DEFAULT_STREAMERS.copy()


def parse_int_list(raw: str | list[int] | list[str] | None, default: list[int]) -> list[int]:
    if raw is None:
        return default.copy()
    items = raw if isinstance(raw, list) else [part.strip() for part in str(raw).split(",")]
    values = sorted({parse_int(item, 0) for item in items if parse_int(item, 0) > 0})
    return values or default.copy()


def normalize_groups(raw_groups: dict[str, Any] | None, streamers: list[str]) -> dict[str, list[str]]:
    valid = set(streamers)
    groups = raw_groups or DEFAULT_GROUPS
    normalized: dict[str, list[str]] = {}
    for group_name, members in groups.items():
        group_members = parse_streamers(members)
        filtered = [member for member in group_members if member in valid]
        if filtered:
            normalized[group_name] = filtered
    if not normalized:
        normalized["Featured"] = streamers[: min(len(streamers), 6)]
    return normalized


def safe_average(values: list[int]) -> int:
    if not values:
        return 0
    return round(sum(values) / len(values))


def compact_text(value: str, limit: int = 120) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "..."


def sort_take(items: list[dict[str, Any]], key: str, limit: int = 5) -> list[dict[str, Any]]:
    return sorted(items, key=lambda item: item.get(key, 0), reverse=True)[:limit]


@dataclass
class AppConfig:
    client_id: str
    client_secret: str
    streamers: list[str]
    streamer_groups: dict[str, list[str]]
    check_interval: int
    discord_webhook: str
    enable_discord_notifications: bool
    history_limit: int
    snapshot_limit: int
    event_limit: int
    alert_thresholds: list[int]
    frontend_title: str
    flask_secret_key: str

    @property
    def is_configured(self) -> bool:
        return (
            bool(self.client_id)
            and bool(self.client_secret)
            and "YOUR_CLIENT" not in self.client_id
            and "YOUR_CLIENT" not in self.client_secret
        )

    def save_to_file(self) -> None:
        file_config = load_json_file(CONFIG_PATH)
        payload = {
            "client_id": file_config.get("client_id", self.client_id),
            "client_secret": file_config.get("client_secret", self.client_secret),
            "streamers": self.streamers,
            "streamer_groups": self.streamer_groups,
            "check_interval": self.check_interval,
            "discord_webhook": file_config.get("discord_webhook", self.discord_webhook),
            "enable_discord_notifications": file_config.get(
                "enable_discord_notifications",
                self.enable_discord_notifications,
            ),
            "history_limit": self.history_limit,
            "snapshot_limit": self.snapshot_limit,
            "event_limit": self.event_limit,
            "alert_thresholds": self.alert_thresholds,
            "frontend_title": self.frontend_title,
        }
        CONFIG_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_config() -> AppConfig:
    load_dotenv_candidates()

    file_config = load_json_file(CONFIG_PATH)
    if not CONFIG_PATH.exists() and SAMPLE_CONFIG_PATH.exists():
        CONFIG_PATH.write_text(SAMPLE_CONFIG_PATH.read_text(encoding="utf-8"), encoding="utf-8")
        file_config = load_json_file(CONFIG_PATH)

    streamers = parse_streamers(os.getenv("TWITCH_STREAMERS", file_config.get("streamers")))
    streamer_groups = normalize_groups(file_config.get("streamer_groups"), streamers)

    return AppConfig(
        client_id=os.getenv("TWITCH_CLIENT_ID", file_config.get("client_id", "")).strip(),
        client_secret=os.getenv("TWITCH_CLIENT_SECRET", file_config.get("client_secret", "")).strip(),
        streamers=streamers,
        streamer_groups=streamer_groups,
        check_interval=max(parse_int(os.getenv("CHECK_INTERVAL", file_config.get("check_interval", 60)), 60), 15),
        discord_webhook=os.getenv("DISCORD_WEBHOOK", file_config.get("discord_webhook", "")).strip(),
        enable_discord_notifications=str(
            os.getenv("ENABLE_DISCORD_NOTIFICATIONS", file_config.get("enable_discord_notifications", False))
        ).lower() in {"1", "true", "yes", "on"},
        history_limit=max(parse_int(os.getenv("HISTORY_LIMIT", file_config.get("history_limit", 12)), 12), 1),
        snapshot_limit=max(parse_int(os.getenv("SNAPSHOT_LIMIT", file_config.get("snapshot_limit", 72)), 72), 12),
        event_limit=max(parse_int(os.getenv("EVENT_LIMIT", file_config.get("event_limit", 30)), 30), 5),
        alert_thresholds=parse_int_list(
            os.getenv("ALERT_THRESHOLDS", file_config.get("alert_thresholds")),
            DEFAULT_ALERT_THRESHOLDS,
        ),
        frontend_title=os.getenv("FRONTEND_TITLE", file_config.get("frontend_title", "Twitch Live Command")).strip()
        or "Twitch Live Command",
        flask_secret_key=os.getenv("FLASK_SECRET_KEY", secrets.token_urlsafe(32)),
    )


class StreamStateStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.state = self._load_state()

    def _default_state(self) -> dict[str, Any]:
        return {"streams": {}, "history": {}, "snapshots": {}, "events": []}

    def _load_state(self) -> dict[str, Any]:
        data = load_json_file(self.path)
        if not all(key in data for key in ("streams", "history", "snapshots", "events")):
            return self._default_state()
        return data

    def _save(self) -> None:
        self.path.write_text(json.dumps(self.state, indent=2), encoding="utf-8")

    def _trim_tail(self, items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
        return items if len(items) <= limit else items[-limit:]

    def recent_sessions(self, login: str, limit: int) -> list[dict[str, Any]]:
        history = self.state.get("history", {}).get(login, [])
        return list(reversed(history[-limit:]))

    def recent_snapshots(self, login: str, limit: int) -> list[dict[str, Any]]:
        snapshots = self.state.get("snapshots", {}).get(login, [])
        return snapshots[-limit:]

    def recent_events(self, limit: int) -> list[dict[str, Any]]:
        return list(reversed(self.state.get("events", [])[-limit:]))

    def analytics_for_login(self, login: str, current_card: dict[str, Any]) -> dict[str, Any]:
        history = self.state.get("history", {}).get(login, [])
        snapshots = self.state.get("snapshots", {}).get(login, [])
        current_state = self.state.get("streams", {}).get(login, {})

        session_count = len(history) + (1 if current_card.get("is_live") else 0)
        completed_minutes = sum(session.get("duration_minutes", 0) for session in history)
        live_minutes = duration_minutes(current_state.get("session_started_at")) if current_card.get("is_live") else 0
        total_minutes = completed_minutes + live_minutes

        peak_values = [session.get("peak_viewers", 0) for session in history]
        if current_card.get("is_live"):
            peak_values.append(current_state.get("peak_viewers", current_card.get("viewer_count", 0)))

        category_counts: dict[str, int] = {}
        hourly_activity = [0] * 24
        weekday_activity = [0] * 7

        for session in history:
            category = session.get("game_name") or "Uncategorized"
            category_counts[category] = category_counts.get(category, 0) + 1
            started = parse_timestamp(session.get("started_at"))
            if started:
                hourly_activity[started.hour] += 1
                weekday_activity[started.weekday()] += 1

        if current_card.get("is_live"):
            category = current_card.get("game_name") or "Uncategorized"
            category_counts[category] = category_counts.get(category, 0) + 1
            started = parse_timestamp(current_card.get("started_at"))
            if started:
                hourly_activity[started.hour] += 1
                weekday_activity[started.weekday()] += 1

        top_category = max(category_counts.items(), key=lambda item: item[1])[0] if category_counts else "Uncategorized"
        recent_viewers = [point.get("viewers", 0) for point in snapshots[-12:]]
        recent_average = safe_average(recent_viewers[-5:])
        avg_peak = safe_average(peak_values)
        consistency_score = min(100, (session_count * 7) + (sum(1 for value in weekday_activity if value) * 6))
        baseline = max(avg_peak, 1)
        trend_score = round((current_card.get("viewer_count", recent_average) / baseline) * 100) if session_count else 0

        return {
            "session_count": session_count,
            "total_minutes": total_minutes,
            "avg_duration_minutes": round(total_minutes / session_count) if session_count else 0,
            "avg_peak_viewers": avg_peak,
            "best_peak_viewers": max(peak_values, default=0),
            "top_category": top_category,
            "consistency_score": consistency_score,
            "trend_score": trend_score,
            "recent_average_viewers": recent_average,
            "hourly_activity": hourly_activity,
            "weekday_activity": weekday_activity,
            "category_breakdown": [
                {"name": name, "value": value}
                for name, value in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
            ][:6],
            "recent_viewers": snapshots[-12:],
            "current_peak_viewers": current_state.get("peak_viewers", current_card.get("viewer_count", 0)),
        }

    def update(
        self,
        *,
        login: str,
        display_name: str,
        is_live: bool,
        started_at: str | None,
        title: str,
        game_name: str,
        viewer_count: int,
        thresholds: list[int],
        history_limit: int,
        snapshot_limit: int,
        event_limit: int,
    ) -> list[dict[str, Any]]:
        with self.lock:
            streams = self.state.setdefault("streams", {})
            history = self.state.setdefault("history", {})
            snapshots = self.state.setdefault("snapshots", {})
            events = self.state.setdefault("events", [])

            previous = streams.get(login, {"is_live": False})
            now_iso = utc_now_iso()
            generated_events: list[dict[str, Any]] = []

            if is_live:
                session_started_at = started_at or previous.get("session_started_at") or now_iso
                previous_peak = parse_int(previous.get("peak_viewers", 0), 0)
                peak_viewers = max(previous_peak, viewer_count)
                viewer_sum = parse_int(previous.get("viewer_sum", 0), 0) + viewer_count
                snapshot_count = parse_int(previous.get("snapshot_count", 0), 0) + 1

                if not previous.get("is_live"):
                    generated_events.append(
                        self._build_event(
                            login=login,
                            display_name=display_name,
                            event_type="went_live",
                            message=f"{display_name} just went live in {game_name or 'a new category'}.",
                            severity="high",
                        )
                    )
                elif previous.get("game_name") and game_name and previous.get("game_name") != game_name:
                    generated_events.append(
                        self._build_event(
                            login=login,
                            display_name=display_name,
                            event_type="category_changed",
                            message=f"{display_name} switched categories to {game_name}.",
                            severity="medium",
                            extra={"from": previous.get("game_name"), "to": game_name},
                        )
                    )

                crossed = self._crossed_threshold(previous_peak, peak_viewers, thresholds)
                if crossed:
                    generated_events.append(
                        self._build_event(
                            login=login,
                            display_name=display_name,
                            event_type="viewer_milestone",
                            message=f"{display_name} passed {crossed:,} viewers.",
                            severity="medium",
                            extra={"threshold": crossed},
                        )
                    )

                snapshots.setdefault(login, []).append(
                    {
                        "timestamp": now_iso,
                        "viewers": viewer_count,
                        "game_name": game_name,
                        "title": compact_text(title, 90),
                    }
                )
                snapshots[login] = self._trim_tail(snapshots[login], snapshot_limit)

                streams[login] = {
                    "is_live": True,
                    "session_started_at": session_started_at,
                    "last_seen_at": now_iso,
                    "title": title,
                    "game_name": game_name,
                    "peak_viewers": peak_viewers,
                    "viewer_sum": viewer_sum,
                    "snapshot_count": snapshot_count,
                    "last_viewer_count": viewer_count,
                    "display_name": display_name,
                }
            else:
                if previous.get("is_live"):
                    ended_at = now_iso
                    session_duration = duration_minutes(previous.get("session_started_at"), ended_at)
                    history.setdefault(login, []).append(
                        {
                            "started_at": previous.get("session_started_at"),
                            "ended_at": ended_at,
                            "title": previous.get("title", ""),
                            "game_name": previous.get("game_name", ""),
                            "avg_viewers": round(
                                parse_int(previous.get("viewer_sum", 0), 0)
                                / max(parse_int(previous.get("snapshot_count", 1), 1), 1)
                            ),
                            "peak_viewers": parse_int(previous.get("peak_viewers", 0), 0),
                            "duration_minutes": session_duration,
                        }
                    )
                    history[login] = self._trim_tail(history[login], max(history_limit * 8, history_limit))
                    generated_events.append(
                        self._build_event(
                            login=login,
                            display_name=display_name,
                            event_type="went_offline",
                            message=f"{display_name} ended stream after {format_minutes(session_duration)}.",
                            severity="low",
                            extra={"duration_minutes": session_duration},
                        )
                    )

                streams[login] = {
                    "is_live": False,
                    "session_started_at": None,
                    "last_seen_at": now_iso,
                    "title": title,
                    "game_name": game_name,
                    "peak_viewers": 0,
                    "viewer_sum": 0,
                    "snapshot_count": 0,
                    "last_viewer_count": 0,
                    "display_name": display_name,
                }

            events.extend(generated_events)
            self.state["events"] = self._trim_tail(events, event_limit)
            self._save()
            return generated_events

    def _crossed_threshold(self, previous_peak: int, current_peak: int, thresholds: list[int]) -> int | None:
        crossed = [threshold for threshold in thresholds if previous_peak < threshold <= current_peak]
        return max(crossed, default=None)

    def _build_event(
        self,
        *,
        login: str,
        display_name: str,
        event_type: str,
        message: str,
        severity: str,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "id": f"{event_type}:{login}:{utc_now_iso()}",
            "type": event_type,
            "login": login,
            "display_name": display_name,
            "message": message,
            "severity": severity,
            "created_at": utc_now_iso(),
        }
        if extra:
            payload.update(extra)
        return payload


class TwitchService:
    def __init__(self, config: AppConfig, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.session = requests.Session()
        self.access_token = ""
        self.token_expires_at = 0.0
        self.state_store = StreamStateStore(STATE_PATH)
        self._cache_lock = threading.Lock()
        self._dashboard_cache: dict[str, Any] | None = None
        self._dashboard_cached_at = 0.0

    def config_error(self) -> str | None:
        if self.config.is_configured:
            return None
        return "Twitch credentials are missing. Add them to twitch_checker/config.json or .env."

    def cache_age_seconds(self) -> int | None:
        if not self._dashboard_cached_at:
            return None
        return int(max(time.time() - self._dashboard_cached_at, 0))

    def cache_status(self) -> dict[str, Any]:
        age_seconds = self.cache_age_seconds()
        ttl_seconds = max(min(self.config.check_interval, 120), 15)
        return {
            "age_seconds": age_seconds,
            "ttl_seconds": ttl_seconds,
            "is_warm": self._dashboard_cache is not None,
            "is_fresh": age_seconds is not None and age_seconds < ttl_seconds,
        }

    def invalidate_cache(self) -> None:
        with self._cache_lock:
            self._dashboard_cache = None
            self._dashboard_cached_at = 0.0

    def ensure_token(self, force_refresh: bool = False) -> None:
        error = self.config_error()
        if error:
            raise RuntimeError(error)

        if not force_refresh and self.access_token and time.time() < self.token_expires_at:
            return

        response = self.session.post(
            TWITCH_OAUTH_URL,
            params={
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret,
                "grant_type": "client_credentials",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
        self.access_token = payload["access_token"]
        self.token_expires_at = time.time() + max(int(payload.get("expires_in", 0)) - 120, 60)

    def _request(self, endpoint: str, params: list[tuple[str, str]] | None = None) -> dict[str, Any]:
        self.ensure_token()
        response = self.session.get(
            f"{TWITCH_API_BASE}/{endpoint}",
            headers={
                "Client-ID": self.config.client_id,
                "Authorization": f"Bearer {self.access_token}",
            },
            params=params,
            timeout=DEFAULT_TIMEOUT,
        )

        if response.status_code == 401:
            self.logger.warning("Refreshing expired Twitch app token")
            self.ensure_token(force_refresh=True)
            response = self.session.get(
                f"{TWITCH_API_BASE}/{endpoint}",
                headers={
                    "Client-ID": self.config.client_id,
                    "Authorization": f"Bearer {self.access_token}",
                },
                params=params,
                timeout=DEFAULT_TIMEOUT,
            )

        response.raise_for_status()
        return response.json()

    def get_config(self) -> dict[str, Any]:
        return {
            "title": self.config.frontend_title,
            "check_interval": self.config.check_interval,
            "streamers": self.config.streamers,
            "streamer_groups": self.config.streamer_groups,
            "history_limit": self.config.history_limit,
            "snapshot_limit": self.config.snapshot_limit,
            "alert_thresholds": self.config.alert_thresholds,
        }

    def get_command_center(self) -> dict[str, Any]:
        error = self.config_error()
        if error:
            return self._build_command_center_fallback(error)
        dashboard = self.get_dashboard()
        return self._build_command_center(dashboard)

    def get_anomaly_summary(self, logins: list[str] | None = None) -> dict[str, Any]:
        error = self.config_error()
        if error:
            tracked_logins = parse_streamers(logins or self.config.streamers)
            return {
                "generated_at": utc_now_iso(),
                "tracked": len(tracked_logins),
                "active_anomalies": [],
                "recent_events": [],
                "counts": {"high": 0, "medium": 0, "watch": 0},
            }

        dashboard = self.get_dashboard(logins)
        alerts = dashboard.get("alerts", [])
        streamers = dashboard.get("streamers", [])

        anomalies: list[dict[str, Any]] = []
        for streamer in streamers:
            analytics = streamer.get("analytics", {})
            trend_score = analytics.get("trend_score", 0)
            consistency = analytics.get("consistency_score", 0)
            best_peak = analytics.get("best_peak_viewers", 0)
            current = streamer.get("viewer_count", 0)
            live = streamer.get("is_live", False)

            severity = None
            reason = None
            if live and trend_score >= 150:
                severity = "high"
                reason = f"Trend score is elevated at {trend_score}."
            elif live and best_peak and current >= int(best_peak * 0.9):
                severity = "medium"
                reason = f"Current viewers are near the historical peak of {best_peak:,}."
            elif not live and consistency >= 75:
                severity = "watch"
                reason = f"High-consistency channel is currently offline after {analytics.get('session_count', 0)} tracked sessions."

            if severity and reason:
                anomalies.append(
                    {
                        "login": streamer["login"],
                        "display_name": streamer["display_name"],
                        "severity": severity,
                        "reason": reason,
                        "viewer_count": current,
                        "trend_score": trend_score,
                        "consistency_score": consistency,
                    }
                )

        return {
            "generated_at": dashboard["generated_at"],
            "tracked": dashboard.get("summary", {}).get("tracked", 0),
            "active_anomalies": anomalies[:8],
            "recent_events": alerts[:8],
            "counts": {
                "high": sum(1 for item in anomalies if item["severity"] == "high"),
                "medium": sum(1 for item in anomalies if item["severity"] == "medium"),
                "watch": sum(1 for item in anomalies if item["severity"] == "watch"),
            },
        }

    def get_compare_summary(self, logins: list[str]) -> dict[str, Any]:
        compared = self.compare_streamers(logins)
        streamers = compared.get("streamers", [])
        if not streamers:
            return {
                "generated_at": compared["generated_at"],
                "streamers": [],
                "leaders": {},
                "summary": {"tracked": 0, "live": 0, "avg_trend_score": 0},
            }

        leaders = {
            "live_viewers": max(streamers, key=lambda item: item.get("viewer_count", 0)),
            "peak_viewers": max(streamers, key=lambda item: item.get("best_peak_viewers", 0)),
            "consistency": max(streamers, key=lambda item: item.get("consistency_score", 0)),
            "momentum": max(streamers, key=lambda item: item.get("trend_score", 0)),
        }
        return {
            "generated_at": compared["generated_at"],
            "streamers": streamers,
            "leaders": leaders,
            "summary": {
                "tracked": len(streamers),
                "live": sum(1 for item in streamers if item.get("is_live")),
                "avg_trend_score": round(sum(item.get("trend_score", 0) for item in streamers) / len(streamers)),
                "avg_consistency_score": round(sum(item.get("consistency_score", 0) for item in streamers) / len(streamers)),
            },
        }

    def get_api_schema(self) -> dict[str, Any]:
        return {
            "openapi": "3.0.0",
            "info": {
                "title": "Audience Operations API",
                "version": "1.1.0",
                "description": "Backend API for Twitch watchlist analytics, command-center summaries, and frontend workspace integration.",
            },
            "servers": [{"url": "/"}],
            "paths": {
                "/api/health": {"get": {"summary": "Health and cache status"}},
                "/api/config": {"get": {"summary": "Frontend/runtime configuration"}},
                "/api/dashboard": {"get": {"summary": "Full dashboard payload"}},
                "/api/command-center": {"get": {"summary": "Derived operational posture and summaries"}},
                "/api/workspace": {"get": {"summary": "Bundled frontend bootstrap payload"}},
                "/api/anomalies": {"get": {"summary": "Derived anomaly and recent event summary"}},
                "/api/compare/summary": {"get": {"summary": "Comparison summary and leaders for selected streamers"}},
                "/api/openapi.json": {"get": {"summary": "Machine-readable API schema"}},
            },
            "components": {
                "schemas": {
                    "WorkspaceBundle": {
                        "type": "object",
                        "properties": {
                            "payload_version": {"type": "string"},
                            "config": {"type": "object"},
                            "health": {"type": "object"},
                            "dashboard": {"type": "object"},
                            "command_center": {"type": "object"},
                            "selected_streamer": {"type": ["object", "null"]},
                            "integration": {"type": "object"},
                        },
                    },
                    "CommandCenter": {
                        "type": "object",
                        "properties": {
                            "posture": {"type": "string"},
                            "posture_score": {"type": "number"},
                            "operation_brief": {"type": "string"},
                            "system_checks": {"type": "array"},
                            "risk_register": {"type": "array"},
                            "zone_status": {"type": "array"},
                            "watchlist_pulse": {"type": "array"},
                            "event_counts": {"type": "object"},
                        },
                    },
                }
            },
        }

    def get_workspace_bundle(self, selected_login: str | None = None, force_refresh: bool = False) -> dict[str, Any]:
        cache = self.cache_status()
        health = {
            "ok": True,
            "configured": self.config_error() is None,
            "error": self.config_error(),
            "generated_at": utc_now_iso(),
            "cache_age_seconds": self.cache_age_seconds(),
            "cache_ttl_seconds": cache["ttl_seconds"],
            "cache_is_warm": cache["is_warm"],
            "cache_is_fresh": cache["is_fresh"],
        }

        if health["configured"]:
            dashboard = self.get_dashboard(force_refresh=force_refresh)
            command_center = self._build_command_center(dashboard)
        else:
            dashboard = {
                "generated_at": utc_now_iso(),
                "title": self.config.frontend_title,
                "check_interval": self.config.check_interval,
                "summary": {
                    "tracked": len(self.config.streamers),
                    "live": 0,
                    "offline": len(self.config.streamers),
                    "current_viewers": 0,
                },
                "overview": {"dominant_category": "Awaiting data"},
                "group_summary": [],
                "leaderboards": {"live_now": [], "best_peak": [], "most_active": [], "trend": []},
                "category_mix": [],
                "alerts": [],
                "streamers": [],
                "compare_defaults": self.config.streamers[: min(4, len(self.config.streamers))],
            }
            command_center = self._build_command_center_fallback(health["error"] or "Configuration required.")

        normalized_login = normalize_login(selected_login) if selected_login else ""
        selected_stream = None
        if normalized_login:
            try:
                selected_stream = self.get_stream(normalized_login) if health["configured"] else None
            except (ValueError, RuntimeError, requests.RequestException):
                selected_stream = None
        if not selected_stream and dashboard.get("streamers"):
            selected_stream = dashboard["streamers"][0]

        return {
            "generated_at": utc_now_iso(),
            "payload_version": "workspace.v1",
            "config": self.get_config(),
            "health": health,
            "dashboard": dashboard,
            "command_center": command_center,
            "anomaly_summary": self.get_anomaly_summary(self.config.streamers if health["configured"] else None),
            "selected_streamer": selected_stream,
            "integration": {
                "recommended_refresh_seconds": self.config.check_interval,
                "supports_search": health["configured"],
                "supports_forecast": ML_AVAILABLE,
                "supports_anomaly_summary": True,
                "supports_compare_summary": True,
                "api_schema": "/api/openapi.json",
                "primary_routes": {
                    "workspace": "/api/workspace",
                    "dashboard": "/api/dashboard",
                    "command_center": "/api/command-center",
                    "anomalies": "/api/anomalies",
                    "compare_summary": "/api/compare/summary?logins=<comma-separated-logins>",
                    "history": "/api/history/<login>",
                    "prediction": "/api/ml/predict/<login>",
                },
            },
        }

    def get_dashboard(self, logins: list[str] | None = None, force_refresh: bool = False) -> dict[str, Any]:
        requested_logins = parse_streamers(logins or self.config.streamers)
        if not requested_logins:
            requested_logins = self.config.streamers

        tracked_set = set(self.config.streamers)
        uses_tracked_subset = set(requested_logins).issubset(tracked_set)

        if uses_tracked_subset:
            base_dashboard = self._get_cached_dashboard(force_refresh=force_refresh)
            if requested_logins == self.config.streamers:
                return copy.deepcopy(base_dashboard)
            return self._slice_dashboard(base_dashboard, requested_logins)

        return self._build_dashboard(requested_logins)

    def get_stream(self, login: str) -> dict[str, Any]:
        if not login:
            raise ValueError("invalid_login")
        dashboard = self.get_dashboard([login])
        return dashboard["streamers"][0]

    def get_analytics_stream(self, login: str) -> dict[str, Any]:
        if not login:
            raise ValueError("invalid_login")
        stream = self.get_stream(login)
        return {
            "login": stream["login"],
            "display_name": stream["display_name"],
            "analytics": stream["analytics"],
            "recent_sessions": stream["recent_sessions"],
            "recent_snapshots": stream["recent_snapshots"],
        }

    def compare_streamers(self, logins: list[str]) -> dict[str, Any]:
        dashboard = self.get_dashboard(logins)
        compared = []
        for card in dashboard["streamers"]:
            analytics = card["analytics"]
            compared.append(
                {
                    "login": card["login"],
                    "display_name": card["display_name"],
                    "is_live": card["is_live"],
                    "viewer_count": card["viewer_count"],
                    "session_count": analytics["session_count"],
                    "avg_duration_minutes": analytics["avg_duration_minutes"],
                    "best_peak_viewers": analytics["best_peak_viewers"],
                    "avg_peak_viewers": analytics["avg_peak_viewers"],
                    "trend_score": analytics["trend_score"],
                    "top_category": analytics["top_category"],
                    "consistency_score": analytics["consistency_score"],
                }
            )
        return {"generated_at": dashboard["generated_at"], "streamers": compared}

    def search_streamers(self, query: str) -> list[dict[str, Any]]:
        search_query = str(query or "").strip()
        if len(search_query) < 2:
            return []

        payload = self._request("search/channels", [("query", search_query), ("first", "8")])
        results: list[dict[str, Any]] = []
        for item in payload.get("data", []):
            login = normalize_login(item.get("broadcaster_login"))
            if not login:
                continue
            results.append(
                {
                    "login": login,
                    "display_name": item.get("display_name", login),
                    "profile_image_url": item.get("thumbnail_url", ""),
                    "game_name": item.get("game_name") or "Offline",
                    "is_live": bool(item.get("is_live")),
                    "is_tracked": login in self.config.streamers,
                }
            )
        return results

    def add_streamer(self, login: str) -> dict[str, Any]:
        normalized = normalize_login(login)
        if not normalized:
            raise ValueError("invalid_login")
        if normalized in self.config.streamers:
            raise ValueError("already_tracked")

        users = self._fetch_users([normalized])
        if normalized not in users:
            raise ValueError("not_found")

        self.config.streamers.append(normalized)
        self.config.streamer_groups = normalize_groups(self.config.streamer_groups, self.config.streamers)
        self.config.streamer_groups.setdefault("Featured", [])
        if normalized not in self.config.streamer_groups["Featured"]:
            self.config.streamer_groups["Featured"].append(normalized)
        self.config.save_to_file()
        self.invalidate_cache()
        return self.get_config()

    def remove_streamer(self, login: str) -> dict[str, Any]:
        normalized = normalize_login(login)
        if not normalized or normalized not in self.config.streamers:
            raise ValueError("not_tracked")

        self.config.streamers = [streamer for streamer in self.config.streamers if streamer != normalized]
        self.config.streamer_groups = {
            group: [member for member in members if member != normalized]
            for group, members in self.config.streamer_groups.items()
        }
        self.config.streamer_groups = normalize_groups(self.config.streamer_groups, self.config.streamers)
        self.config.save_to_file()
        self.invalidate_cache()
        return self.get_config()

    def prediction_data_for_login(self, login: str, limit: int = 60) -> list[dict[str, Any]]:
        snapshots = get_recent_snapshots(login, limit) if ML_AVAILABLE else []
        if len(snapshots) >= 5:
            return snapshots

        fallback = self.state_store.recent_snapshots(login, limit)
        if fallback:
            return [
                {
                    "timestamp": item["timestamp"],
                    "viewer_count": item.get("viewers", 0),
                    "game_name": item.get("game_name", ""),
                    "title": item.get("title", ""),
                }
                for item in fallback
            ]
        return snapshots

    def _build_command_center_fallback(self, error: str) -> dict[str, Any]:
        watchlist_size = len(self.config.streamers)
        checks = [
            {"name": "Twitch credentials", "status": "blocked", "detail": error},
            {
                "name": "Watchlist scope",
                "status": "healthy" if watchlist_size else "watch",
                "detail": f"{watchlist_size} tracked creators are configured locally.",
            },
            {
                "name": "Forecast layer",
                "status": "watch",
                "detail": "Historical forecasting remains available once local session data accumulates.",
            },
            {
                "name": "Discord notifications",
                "status": "healthy" if self.config.enable_discord_notifications and self.config.discord_webhook else "watch",
                "detail": "Webhook is configured." if self.config.enable_discord_notifications and self.config.discord_webhook else "Notifications are optional and currently inactive.",
            },
        ]
        return {
            "generated_at": utc_now_iso(),
            "posture": "Credential Mode",
            "posture_score": 16,
            "operation_brief": "The dashboard is in credential mode. The layout stays usable, but live Twitch telemetry, search, and live-event scoring are waiting on a client ID and secret.",
            "system_checks": checks,
            "risk_register": [
                {
                    "name": "Telemetry blocked",
                    "status": "high",
                    "detail": "Without Twitch credentials, the watchlist cannot pull live status or audience counts.",
                }
            ],
            "zone_status": [
                {"name": "Overview", "status": "watch", "detail": "Presentation mode is active with placeholder summary values."},
                {"name": "Operations", "status": "watch", "detail": "Forecast and player remain visible, but live operations are offline."},
                {"name": "Analysis", "status": "watch", "detail": "Historical analytics improve as local tracking data accumulates."},
                {"name": "Archive", "status": "healthy", "detail": "Stored local state can still power sessions, events, and fallback archive views."},
            ],
            "watchlist_pulse": [
                {
                    "login": login,
                    "display_name": login,
                    "status": "standby",
                    "value": 0,
                    "detail": "Awaiting live audience data after credentials are added.",
                }
                for login in self.config.streamers[:4]
            ],
            "event_counts": {"high": 1, "medium": 0, "low": 0},
        }

    def _build_command_center(self, dashboard: dict[str, Any]) -> dict[str, Any]:
        alerts = dashboard.get("alerts", [])
        summary = dashboard.get("summary", {})
        streamers = dashboard.get("streamers", [])

        high_events = sum(1 for alert in alerts if alert.get("severity") == "high")
        medium_events = sum(1 for alert in alerts if alert.get("severity") == "medium")
        low_events = sum(1 for alert in alerts if alert.get("severity") == "low")
        live_ratio = (summary.get("live", 0) / max(summary.get("tracked", 1), 1)) if summary.get("tracked", 0) else 0
        viewers = summary.get("current_viewers", 0)
        top_streamer = max(streamers, key=lambda item: item.get("viewer_count", 0), default=None)

        posture_score = 18
        posture_score += min(int(live_ratio * 34), 34)
        posture_score += min(viewers // 6000, 18)
        posture_score += min(high_events * 16 + medium_events * 7 + low_events * 2, 24)
        posture_score += 8 if top_streamer and top_streamer.get("is_live") else 0
        posture_score = max(min(posture_score, 100), 0)

        if posture_score >= 78:
            posture = "Critical"
        elif posture_score >= 56:
            posture = "Elevated"
        elif posture_score >= 34:
            posture = "Watch"
        else:
            posture = "Nominal"

        system_checks = [
            {"name": "Twitch credentials", "status": "healthy", "detail": "Authenticated against the Twitch API."},
            {
                "name": "Dashboard cache",
                "status": "healthy" if (self.cache_age_seconds() or 0) <= max(self.config.check_interval * 2, 90) else "watch",
                "detail": f"Cache age is {self.cache_age_seconds() or 0}s with a {self.config.check_interval}s refresh cadence.",
            },
            {
                "name": "Watchlist coverage",
                "status": "healthy" if summary.get("tracked", 0) >= 6 else "watch",
                "detail": f"{summary.get('tracked', 0)} creators are currently tracked across {len(self.config.streamer_groups)} groups.",
            },
            {
                "name": "Alert thresholds",
                "status": "healthy" if self.config.alert_thresholds else "watch",
                "detail": f"{len(self.config.alert_thresholds)} milestone thresholds are armed.",
            },
            {
                "name": "Forecast layer",
                "status": "healthy" if ML_AVAILABLE else "watch",
                "detail": "Machine-learning forecast helpers are available." if ML_AVAILABLE else "Prediction falls back to stored local history.",
            },
            {
                "name": "Discord notifications",
                "status": "healthy" if self.config.enable_discord_notifications and self.config.discord_webhook else "watch",
                "detail": "Webhook dispatch is armed." if self.config.enable_discord_notifications and self.config.discord_webhook else "Webhook dispatch is not active.",
            },
        ]

        risk_candidates: list[dict[str, Any]] = []
        for streamer in streamers:
            analytics = streamer.get("analytics", {})
            trend_score = analytics.get("trend_score", 0)
            consistency = analytics.get("consistency_score", 0)
            peak = analytics.get("best_peak_viewers", 0)
            current = streamer.get("viewer_count", 0)

            if streamer.get("is_live") and trend_score >= 140:
                risk_candidates.append(
                    {
                        "name": streamer["display_name"],
                        "status": "high",
                        "detail": f"Momentum is running hot at {trend_score} with {current:,} live viewers.",
                    }
                )
            elif streamer.get("is_live") and current and peak and current >= int(peak * 0.85):
                risk_candidates.append(
                    {
                        "name": streamer["display_name"],
                        "status": "medium",
                        "detail": f"Current audience is nearing its historical peak at {current:,} viewers.",
                    }
                )
            elif not streamer.get("is_live") and consistency >= 70:
                risk_candidates.append(
                    {
                        "name": streamer["display_name"],
                        "status": "watch",
                        "detail": f"Highly consistent creator is currently offline; keep them in the monitoring rotation.",
                    }
                )

        for alert in alerts[:3]:
            risk_candidates.append(
                {
                    "name": alert.get("display_name", alert.get("login", "Watchlist event")),
                    "status": alert.get("severity", "watch"),
                    "detail": alert.get("message", "Recent event surfaced in the watchlist."),
                }
            )

        zone_status = [
            {
                "name": "Overview",
                "status": "healthy" if summary.get("tracked", 0) else "watch",
                "detail": f"{summary.get('tracked', 0)} creators, {summary.get('live', 0)} live, and {summary.get('current_viewers', 0):,} concurrent viewers.",
            },
            {
                "name": "Operations",
                "status": "healthy" if summary.get("live", 0) else "watch",
                "detail": f"{summary.get('live', 0)} live operations with forecast canvas and embedded watch ready.",
            },
            {
                "name": "Analysis",
                "status": "healthy" if dashboard.get("category_mix") else "watch",
                "detail": f"{len(dashboard.get('leaderboards', {}).get('trend', []))} ranked momentum entries and {len(dashboard.get('category_mix', []))} active taxonomy buckets.",
            },
            {
                "name": "Archive",
                "status": "healthy" if alerts else "watch",
                "detail": f"{len(alerts)} recent events and rolling session history are available for review.",
            },
        ]

        pulse_rows = []
        for streamer in sorted(
            streamers,
            key=lambda item: (
                1 if item.get("is_live") else 0,
                item.get("analytics", {}).get("trend_score", 0),
                item.get("viewer_count", 0),
            ),
            reverse=True,
        )[:6]:
            analytics = streamer.get("analytics", {})
            pulse_rows.append(
                {
                    "login": streamer["login"],
                    "display_name": streamer["display_name"],
                    "status": "live" if streamer.get("is_live") else "standby",
                    "value": streamer.get("viewer_count") or analytics.get("best_peak_viewers", 0),
                    "detail": (
                        f"{streamer.get('viewer_count', 0):,} live viewers, trend {analytics.get('trend_score', 0)}"
                        if streamer.get("is_live")
                        else f"{analytics.get('session_count', 0)} sessions tracked, consistency {analytics.get('consistency_score', 0)}"
                    ),
                }
            )

        hottest_text = (
            f"{top_streamer['display_name']} leads the board with {top_streamer.get('viewer_count', 0):,} viewers."
            if top_streamer and top_streamer.get("is_live")
            else "No creator is live right now, so the board is leaning on stored behavior and session history."
        )
        operation_brief = (
            f"{hottest_text} "
            f"{summary.get('live', 0)} of {summary.get('tracked', 0)} tracked creators are active, with "
            f"{high_events} high-severity and {medium_events} medium-severity recent events shaping posture."
        )

        return {
            "generated_at": dashboard.get("generated_at", utc_now_iso()),
            "posture": posture,
            "posture_score": posture_score,
            "operation_brief": operation_brief,
            "system_checks": system_checks,
            "risk_register": risk_candidates[:5],
            "zone_status": zone_status,
            "watchlist_pulse": pulse_rows,
            "event_counts": {"high": high_events, "medium": medium_events, "low": low_events},
        }

    def _get_cached_dashboard(self, force_refresh: bool = False) -> dict[str, Any]:
        with self._cache_lock:
            ttl_seconds = max(min(self.config.check_interval, 120), 15)
            is_fresh = self._dashboard_cache is not None and (time.time() - self._dashboard_cached_at) < ttl_seconds
            if not force_refresh and is_fresh:
                return copy.deepcopy(self._dashboard_cache)

            dashboard = self._build_dashboard(self.config.streamers)
            self._dashboard_cache = dashboard
            self._dashboard_cached_at = time.time()
            return copy.deepcopy(dashboard)

    def _slice_dashboard(self, dashboard: dict[str, Any], logins: list[str]) -> dict[str, Any]:
        by_login = {card["login"]: card for card in dashboard["streamers"]}
        sliced_cards = [copy.deepcopy(by_login[login]) for login in logins if login in by_login]
        analytics_map = {card["login"]: card["analytics"] for card in sliced_cards}

        sliced = copy.deepcopy(dashboard)
        sliced["streamers"] = sliced_cards
        sliced["summary"] = {
            "tracked": len(sliced_cards),
            "live": sum(1 for card in sliced_cards if card["is_live"]),
            "offline": sum(1 for card in sliced_cards if not card["is_live"]),
            "current_viewers": sum(card["viewer_count"] for card in sliced_cards if card["is_live"]),
        }
        sliced["overview"] = self._build_overview(sliced_cards, analytics_map)
        sliced["leaderboards"] = self._build_leaderboards(sliced_cards, analytics_map)
        sliced["group_summary"] = self._build_group_summary(sliced_cards)
        sliced["category_mix"] = self._build_category_mix(sliced_cards, analytics_map)
        sliced["compare_defaults"] = logins[: min(4, len(logins))]
        return sliced

    def _build_dashboard(self, requested_logins: list[str]) -> dict[str, Any]:
        error = self.config_error()
        if error:
            raise RuntimeError(error)

        users = self._fetch_users(requested_logins)
        streams = self._fetch_streams(requested_logins)

        cards: list[dict[str, Any]] = []
        analytics_map: dict[str, dict[str, Any]] = {}

        for login in requested_logins:
            user = users.get(login, {})
            stream = streams.get(login, {})
            display_name = user.get("display_name", login)
            is_live = bool(stream)
            viewer_count = parse_int(stream.get("viewer_count", 0), 0)
            game_name = stream.get("game_name", "")
            title = stream.get("title", "")

            generated_events = self.state_store.update(
                login=login,
                display_name=display_name,
                is_live=is_live,
                started_at=stream.get("started_at"),
                title=title,
                game_name=game_name,
                viewer_count=viewer_count,
                thresholds=self.config.alert_thresholds,
                history_limit=self.config.history_limit,
                snapshot_limit=self.config.snapshot_limit,
                event_limit=self.config.event_limit,
            )

            if any(event["type"] == "went_live" for event in generated_events):
                self._send_discord_notification(login, display_name, user, stream)

            if ML_AVAILABLE and is_live:
                log_stream_snapshot(login, viewer_count, game_name, title)
                demo_messages = ["pog", "w stream", "hype"] if viewer_count > 10000 else ["nice", "steady stream"]
                sentiment_data = analyze_chat_sentiment(demo_messages)
                log_chat_sentiment(login, sentiment_data["score"], len(demo_messages))

            card = {
                "login": login,
                "display_name": display_name,
                "is_live": is_live,
                "title": title,
                "game_name": game_name,
                "viewer_count": viewer_count,
                "started_at": stream.get("started_at"),
                "uptime": format_uptime(stream.get("started_at")),
                "profile_image_url": user.get("profile_image_url", ""),
                "offline_image_url": user.get("offline_image_url", ""),
                "thumbnail_url": flatten_thumbnail(stream.get("thumbnail_url")),
                "url": f"https://www.twitch.tv/{login}",
                "description": user.get("description", ""),
                "broadcaster_type": user.get("broadcaster_type", "") or "standard",
                "last_seen_at": utc_now_iso(),
                "groups": [group for group, members in self.config.streamer_groups.items() if login in members],
                "recent_sessions": self.state_store.recent_sessions(login, self.config.history_limit),
                "recent_snapshots": self.state_store.recent_snapshots(login, 12),
            }
            analytics = self.state_store.analytics_for_login(login, card)
            card["analytics"] = analytics
            cards.append(card)
            analytics_map[login] = analytics

        return {
            "generated_at": utc_now_iso(),
            "title": self.config.frontend_title,
            "check_interval": self.config.check_interval,
            "streamers": cards,
            "summary": {
                "tracked": len(cards),
                "live": sum(1 for card in cards if card["is_live"]),
                "offline": sum(1 for card in cards if not card["is_live"]),
                "current_viewers": sum(card["viewer_count"] for card in cards if card["is_live"]),
            },
            "overview": self._build_overview(cards, analytics_map),
            "leaderboards": self._build_leaderboards(cards, analytics_map),
            "group_summary": self._build_group_summary(cards),
            "category_mix": self._build_category_mix(cards, analytics_map),
            "alerts": self.state_store.recent_events(self.config.event_limit),
            "compare_defaults": requested_logins[: min(4, len(requested_logins))],
        }

    def _fetch_users(self, logins: list[str]) -> dict[str, dict[str, Any]]:
        payload = self._request("users", [("login", login) for login in logins])
        return {item["login"].lower(): item for item in payload.get("data", [])}

    def _fetch_streams(self, logins: list[str]) -> dict[str, dict[str, Any]]:
        payload = self._request("streams", [("user_login", login) for login in logins])
        return {item["user_login"].lower(): item for item in payload.get("data", [])}

    def _build_overview(self, cards: list[dict[str, Any]], analytics_map: dict[str, dict[str, Any]]) -> dict[str, Any]:
        live_cards = [card for card in cards if card["is_live"]]
        top_live = max(live_cards, key=lambda card: card["viewer_count"], default=None)
        most_consistent = max(
            cards,
            key=lambda card: analytics_map[card["login"]]["consistency_score"],
            default=None,
        )
        biggest_peak = max(
            cards,
            key=lambda card: analytics_map[card["login"]]["best_peak_viewers"],
            default=None,
        )

        hourly_activity = [0] * 24
        weekday_activity = [0] * 7
        for analytics in analytics_map.values():
            hourly_activity = [left + right for left, right in zip(hourly_activity, analytics["hourly_activity"])]
            weekday_activity = [left + right for left, right in zip(weekday_activity, analytics["weekday_activity"])]

        dominant_category = max(
            self._build_category_mix(cards, analytics_map),
            key=lambda item: item["value"],
            default={"name": "Uncategorized", "value": 0},
        )

        return {
            "tracked": len(cards),
            "live": len(live_cards),
            "offline": max(len(cards) - len(live_cards), 0),
            "current_viewers": sum(card["viewer_count"] for card in live_cards),
            "avg_live_viewers": round(sum(card["viewer_count"] for card in live_cards) / len(live_cards)) if live_cards else 0,
            "dominant_category": dominant_category["name"],
            "hottest_stream": {
                "display_name": top_live["display_name"],
                "viewer_count": top_live["viewer_count"],
                "login": top_live["login"],
            }
            if top_live
            else None,
            "most_consistent": {
                "display_name": most_consistent["display_name"],
                "score": analytics_map[most_consistent["login"]]["consistency_score"],
                "login": most_consistent["login"],
            }
            if most_consistent
            else None,
            "biggest_peak": {
                "display_name": biggest_peak["display_name"],
                "peak_viewers": analytics_map[biggest_peak["login"]]["best_peak_viewers"],
                "login": biggest_peak["login"],
            }
            if biggest_peak
            else None,
            "hourly_activity": hourly_activity,
            "weekday_activity": weekday_activity,
        }

    def _build_leaderboards(
        self,
        cards: list[dict[str, Any]],
        analytics_map: dict[str, dict[str, Any]],
    ) -> dict[str, list[dict[str, Any]]]:
        live_now = sort_take(
            [
                {
                    "display_name": card["display_name"],
                    "login": card["login"],
                    "value": card["viewer_count"],
                    "meta": card["game_name"] or "Offline",
                }
                for card in cards
                if card["is_live"]
            ],
            "value",
        )
        best_peak = sort_take(
            [
                {
                    "display_name": card["display_name"],
                    "login": card["login"],
                    "value": analytics_map[card["login"]]["best_peak_viewers"],
                    "meta": analytics_map[card["login"]]["top_category"],
                }
                for card in cards
            ],
            "value",
        )
        most_active = sort_take(
            [
                {
                    "display_name": card["display_name"],
                    "login": card["login"],
                    "value": analytics_map[card["login"]]["session_count"],
                    "meta": f"{analytics_map[card['login']]['avg_duration_minutes']}m avg",
                }
                for card in cards
            ],
            "value",
        )
        trend = sort_take(
            [
                {
                    "display_name": card["display_name"],
                    "login": card["login"],
                    "value": analytics_map[card["login"]]["trend_score"],
                    "meta": analytics_map[card["login"]]["top_category"],
                }
                for card in cards
            ],
            "value",
        )
        return {
            "live_now": live_now,
            "best_peak": best_peak,
            "most_active": most_active,
            "trend": trend,
        }

    def _build_group_summary(self, cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        summary: list[dict[str, Any]] = []
        for group_name, members in self.config.streamer_groups.items():
            group_cards = [card for card in cards if card["login"] in members]
            if not group_cards:
                continue
            summary.append(
                {
                    "name": group_name,
                    "tracked": len(group_cards),
                    "live": sum(1 for card in group_cards if card["is_live"]),
                    "current_viewers": sum(card["viewer_count"] for card in group_cards if card["is_live"]),
                }
            )
        return summary

    def _build_category_mix(
        self,
        cards: list[dict[str, Any]],
        analytics_map: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        category_totals: dict[str, int] = {}
        for card in cards:
            for item in analytics_map[card["login"]]["category_breakdown"]:
                category_totals[item["name"]] = category_totals.get(item["name"], 0) + item["value"]
        return [
            {"name": name, "value": value}
            for name, value in sorted(category_totals.items(), key=lambda item: item[1], reverse=True)
        ][:8]

    def _send_discord_notification(
        self,
        login: str,
        display_name: str,
        user: dict[str, Any],
        stream: dict[str, Any],
    ) -> None:
        if not self.config.enable_discord_notifications or not self.config.discord_webhook:
            return

        content = {
            "embeds": [
                {
                    "title": f"{display_name} just went live",
                    "description": stream.get("title", "Live on Twitch"),
                    "url": f"https://www.twitch.tv/{login}",
                    "color": 15105570,
                    "fields": [
                        {"name": "Category", "value": stream.get("game_name", "Unknown"), "inline": True},
                        {"name": "Viewers", "value": str(stream.get("viewer_count", 0)), "inline": True},
                    ],
                    "thumbnail": {"url": user.get("profile_image_url", "")},
                }
            ]
        }

        try:
            response = self.session.post(self.config.discord_webhook, json=content, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException as exc:
            self.logger.warning("Discord notification failed for %s: %s", login, exc)


def build_logger() -> logging.Logger:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    return logging.getLogger("audience-signal-lab")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
    config = load_config()
    app.config["SECRET_KEY"] = config.flask_secret_key
    app.logger.handlers = build_logger().handlers
    app.logger.setLevel(logging.INFO)
    service = TwitchService(config, app.logger)

    def json_service_response(fn: Any, status_code: int = 200) -> Response:
        try:
            return jsonify(fn()), status_code
        except ValueError as exc:
            code = str(exc)
            message_map = {
                "invalid_login": "A Twitch login should use only letters, numbers, or underscores.",
                "already_tracked": "That streamer is already in the watchlist.",
                "not_found": "That Twitch channel could not be found.",
                "not_tracked": "That streamer is not currently being tracked.",
            }
            return jsonify({"error": code, "detail": message_map.get(code, code)}), 400
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    @app.after_request
    def apply_security_headers(response: Response) -> Response:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.get("/")
    def index() -> Any:
        return send_from_directory(BASE_DIR, "dashboard.html")

    @app.get("/api/health")
    def health() -> Any:
        error = service.config_error()
        cache = service.cache_status()
        status = {
            "ok": True,
            "configured": error is None,
            "error": error,
            "generated_at": utc_now_iso(),
            "cache_age_seconds": service.cache_age_seconds(),
            "cache_ttl_seconds": cache["ttl_seconds"],
            "cache_is_warm": cache["is_warm"],
            "cache_is_fresh": cache["is_fresh"],
        }
        return jsonify(status), 200

    @app.get("/api/config")
    def frontend_config() -> Any:
        return jsonify(service.get_config())

    @app.get("/api/dashboard")
    def dashboard() -> Any:
        refresh = request.args.get("refresh") in {"1", "true", "yes"}
        requested = request.args.get("logins")
        logins = parse_streamers(requested) if requested else None
        return json_service_response(lambda: service.get_dashboard(logins, force_refresh=refresh))

    @app.get("/api/command-center")
    def command_center() -> Any:
        return jsonify(service.get_command_center())

    @app.get("/api/workspace")
    def workspace() -> Any:
        refresh = request.args.get("refresh") in {"1", "true", "yes"}
        selected_login = request.args.get("selected")
        return jsonify(service.get_workspace_bundle(selected_login=selected_login, force_refresh=refresh))

    @app.get("/api/anomalies")
    def anomalies() -> Any:
        requested = request.args.get("logins")
        logins = parse_streamers(requested) if requested else None
        return json_service_response(lambda: service.get_anomaly_summary(logins))

    @app.get("/api/compare/summary")
    def compare_summary() -> Any:
        requested = request.args.get("logins")
        logins = parse_streamers(requested) if requested else config.streamers[:4]
        return json_service_response(lambda: service.get_compare_summary(logins))

    @app.get("/api/openapi.json")
    def openapi_schema() -> Any:
        return jsonify(service.get_api_schema())

    @app.get("/api/stream/<login>")
    def stream(login: str) -> Any:
        normalized = normalize_login(login)
        if not normalized:
            return jsonify({"error": "invalid_login", "detail": "Invalid Twitch login."}), 400
        return json_service_response(lambda: service.get_stream(normalized))

    @app.get("/api/history/<login>")
    def history(login: str) -> Any:
        normalized = normalize_login(login)
        if not normalized:
            return jsonify({"error": "invalid_login", "detail": "Invalid Twitch login."}), 400
        return jsonify(
            {
                "login": normalized,
                "recent_sessions": service.state_store.recent_sessions(normalized, config.history_limit),
                "recent_snapshots": service.state_store.recent_snapshots(normalized, config.snapshot_limit),
            }
        )

    @app.get("/api/ml/predict/<login>")
    def predict(login: str) -> Any:
        normalized = normalize_login(login)
        if not normalized:
            return jsonify({"error": "invalid_login", "detail": "Invalid Twitch login."}), 400
        if not ML_AVAILABLE:
            return jsonify({"status": "ml_not_enabled", "login": normalized}), 501

        data_points = service.prediction_data_for_login(normalized, 60)
        if not data_points:
            return jsonify({"status": "no_data_in_db", "login": normalized})

        prediction = predict_peak_viewers(data_points)
        return jsonify({"login": normalized, "data_points_used": len(data_points), **prediction})

    @app.get("/api/search")
    def search() -> Any:
        query = request.args.get("q", "").strip()
        return json_service_response(lambda: service.search_streamers(query))

    @app.post("/api/watchlist")
    def add_watchlist() -> Any:
        payload = request.get_json(silent=True) or {}
        login = payload.get("login")
        return json_service_response(lambda: service.add_streamer(login), status_code=201)

    @app.delete("/api/watchlist/<login>")
    def remove_watchlist(login: str) -> Any:
        return json_service_response(lambda: service.remove_streamer(login))

    @app.get("/api/analytics/overview")
    def analytics_overview() -> Any:
        def payload() -> dict[str, Any]:
            dashboard_data = service.get_dashboard()
            return {
                "generated_at": dashboard_data["generated_at"],
                "overview": dashboard_data["overview"],
                "group_summary": dashboard_data["group_summary"],
                "category_mix": dashboard_data["category_mix"],
            }

        return json_service_response(payload)

    @app.get("/api/analytics/leaderboards")
    def analytics_leaderboards() -> Any:
        def payload() -> dict[str, Any]:
            dashboard_data = service.get_dashboard()
            return {
                "generated_at": dashboard_data["generated_at"],
                "leaderboards": dashboard_data["leaderboards"],
            }

        return json_service_response(payload)

    @app.get("/api/analytics/compare")
    def analytics_compare() -> Any:
        requested = request.args.get("logins")
        logins = parse_streamers(requested) if requested else config.streamers[:4]
        return json_service_response(lambda: service.compare_streamers(logins))

    @app.get("/api/analytics/stream/<login>")
    def analytics_stream(login: str) -> Any:
        normalized = normalize_login(login)
        if not normalized:
            return jsonify({"error": "invalid_login", "detail": "Invalid Twitch login."}), 400
        return json_service_response(lambda: service.get_analytics_stream(normalized))

    return app


app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = parse_int(os.getenv("PORT", "5050"), 5050)
    print(f"Audience Signal Lab is running on {host}:{port}")
    print("Use twitch_checker/config.json or .env to add real Twitch credentials.")
    app.run(host=host, port=port, debug=False)
