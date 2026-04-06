from __future__ import annotations

import json
import logging
import os
import secrets
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

try:
    from database import log_stream_snapshot, get_recent_snapshots, log_chat_sentiment
    from ml_models import predict_peak_viewers, analyze_chat_sentiment
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
PACKAGE_DIR = Path(__file__).resolve().parent
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


def format_uptime(started_at: str | None) -> str:
    started = parse_timestamp(started_at)
    if not started:
        return "Offline"

    elapsed = utc_now() - started
    minutes = max(int(elapsed.total_seconds() // 60), 0)
    return format_minutes(minutes)


def format_minutes(minutes: int) -> str:
    hours, mins = divmod(max(minutes, 0), 60)
    if hours >= 24:
        days, rem_hours = divmod(hours, 24)
        return f"{days}d {rem_hours}h {mins}m"
    if hours:
        return f"{hours}h {mins}m"
    return f"{mins}m"


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
    candidates = [
        BASE_DIR / ".env",
        BASE_DIR.parent / ".env",
        Path.cwd() / ".env",
    ]
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


def parse_streamers(raw: str | list[str] | None) -> list[str]:
    if raw is None:
        return DEFAULT_STREAMERS.copy()
    if isinstance(raw, list):
        items = raw
    else:
        items = [item.strip() for item in raw.split(",")]
    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        login = item.strip().lower().lstrip("@")
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
    return value[: limit - 1].rstrip() + "…"


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


def load_config() -> AppConfig:
    load_dotenv_candidates()

    file_config = load_json_file(CONFIG_PATH)
    if not CONFIG_PATH.exists() and SAMPLE_CONFIG_PATH.exists():
        CONFIG_PATH.write_text(
            SAMPLE_CONFIG_PATH.read_text(encoding="utf-8"),
            encoding="utf-8",
        )

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
            os.getenv(
                "ENABLE_DISCORD_NOTIFICATIONS",
                file_config.get("enable_discord_notifications", False),
            )
        ).lower() in {"1", "true", "yes", "on"},
        history_limit=max(parse_int(os.getenv("HISTORY_LIMIT", file_config.get("history_limit", 12)), 12), 1),
        snapshot_limit=max(parse_int(os.getenv("SNAPSHOT_LIMIT", file_config.get("snapshot_limit", 72)), 72), 12),
        event_limit=max(parse_int(os.getenv("EVENT_LIMIT", file_config.get("event_limit", 30)), 30), 5),
        alert_thresholds=parse_int_list(
            os.getenv("ALERT_THRESHOLDS", file_config.get("alert_thresholds")),
            DEFAULT_ALERT_THRESHOLDS,
        ),
        frontend_title=os.getenv("FRONTEND_TITLE", file_config.get("frontend_title", "Twitch Live Radar")).strip()
        or "Twitch Live Radar",
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
        if len(items) <= limit:
            return items
        return items[-limit:]

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
                prev_peak = parse_int(previous.get("peak_viewers", 0), 0)
                peak_viewers = max(prev_peak, viewer_count)
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

                crossed = self._crossed_threshold(prev_peak, peak_viewers, thresholds)
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
        timestamp = utc_now_iso()
        payload = {
            "id": f"{event_type}:{login}:{timestamp}",
            "type": event_type,
            "login": login,
            "display_name": display_name,
            "message": message,
            "severity": severity,
            "created_at": timestamp,
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

    def config_error(self) -> str | None:
        if self.config.is_configured:
            return None
        return "Twitch credentials are missing. Add them to twitch_checker/config.json or .env."

    def ensure_token(self, force_refresh: bool = False) -> None:
        if self.config_error():
            raise RuntimeError(self.config_error())

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

    def get_dashboard(self, logins: list[str] | None = None) -> dict[str, Any]:
        error = self.config_error()
        if error:
            raise RuntimeError(error)

        requested_logins = parse_streamers(logins or self.config.streamers)
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

            try:
                if is_live:
                    log_stream_snapshot(login, viewer_count, game_name, title)
                    # For demo purposes, we will feed a hardcoded chat snippet depending on viewers
                    # because IRC takes continuous polling.
                    demo_msgs = ["POG", "w stream", "hype"] if viewer_count > 10000 else ["nice", "hello block"]
                    sentiment_data = analyze_chat_sentiment(demo_msgs)
                    log_chat_sentiment(login, sentiment_data['score'], len(demo_msgs))
            except NameError:
                pass

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

        overview = self._build_overview(cards, analytics_map)
        leaderboards = self._build_leaderboards(cards, analytics_map)
        group_summary = self._build_group_summary(cards)
        category_mix = self._build_category_mix(cards, analytics_map)
        compare_defaults = requested_logins[: min(4, len(requested_logins))]

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
            "overview": overview,
            "leaderboards": leaderboards,
            "group_summary": group_summary,
            "category_mix": category_mix,
            "alerts": self.state_store.recent_events(self.config.event_limit),
            "compare_defaults": compare_defaults,
        }

    def get_stream(self, login: str) -> dict[str, Any]:
        dashboard = self.get_dashboard([login])
        return dashboard["streamers"][0]

    def get_analytics_stream(self, login: str) -> dict[str, Any]:
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

    def _fetch_users(self, logins: list[str]) -> dict[str, dict[str, Any]]:
        payload = self._request("users", [("login", login) for login in logins])
        return {item["login"].lower(): item for item in payload.get("data", [])}

    def _fetch_streams(self, logins: list[str]) -> dict[str, dict[str, Any]]:
        payload = self._request("streams", [("user_login", login) for login in logins])
        return {item["user_login"].lower(): item for item in payload.get("data", [])}

    def _build_overview(
        self,
        cards: list[dict[str, Any]],
        analytics_map: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
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
            } if top_live else None,
            "most_consistent": {
                "display_name": most_consistent["display_name"],
                "score": analytics_map[most_consistent["login"]]["consistency_score"],
                "login": most_consistent["login"],
            } if most_consistent else None,
            "biggest_peak": {
                "display_name": biggest_peak["display_name"],
                "peak_viewers": analytics_map[biggest_peak["login"]]["best_peak_viewers"],
                "login": biggest_peak["login"],
            } if biggest_peak else None,
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
            response = self.session.post(
                self.config.discord_webhook,
                json=content,
                timeout=DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            self.logger.warning("Discord notification failed for %s: %s", login, exc)


def build_logger() -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    return logging.getLogger("twitch-live-radar")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
    config = load_config()
    app.config["SECRET_KEY"] = config.flask_secret_key
    app.logger.handlers = build_logger().handlers
    app.logger.setLevel(logging.INFO)
    service = TwitchService(config, app.logger)

    @app.get("/")
    def index() -> Any:
        return send_from_directory(BASE_DIR, "dashboard.html")

    @app.get("/api/health")
    def health() -> Any:
        error = service.config_error()
        return jsonify(
            {
                "ok": error is None,
                "configured": error is None,
                "error": error,
                "generated_at": utc_now_iso(),
            }
        ), (200 if error is None else 503)

    @app.get("/api/dashboard")
    def dashboard() -> Any:
        logins = parse_streamers(request.args.get("logins")) if request.args.get("logins") else None
        try:
            return jsonify(service.get_dashboard(logins))
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    @app.get("/api/stream/<login>")
    def stream(login: str) -> Any:
        try:
            return jsonify(service.get_stream(login.lower()))
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    @app.get("/api/history/<login>")
    def history(login: str) -> Any:
        normalized = login.lower().strip()
        return jsonify(
            {
                "login": normalized,
                "recent_sessions": service.state_store.recent_sessions(
                    normalized,
                    config.history_limit,
                ),
                "recent_snapshots": service.state_store.recent_snapshots(
                    normalized,
                    config.snapshot_limit,
                ),
            }
        )

    @app.get("/api/ml/predict/<login>")
    def predict(login: str) -> Any:
        try:
            normalized = login.lower().strip()
            recent_db_snaps = get_recent_snapshots(normalized, 60)
            if not recent_db_snaps:
                return jsonify({"status": "no_data_in_db"})
            
            prediction = predict_peak_viewers(recent_db_snaps)
            return jsonify({
                "login": normalized,
                "prediction": prediction,
                "data_points_used": len(recent_db_snaps)
            })
        except NameError:
            return jsonify({"status": "ml_not_enabled"}), 501

    @app.get("/api/config")
    def frontend_config() -> Any:
        return jsonify(
            {
                "title": config.frontend_title,
                "check_interval": config.check_interval,
                "streamers": config.streamers,
                "streamer_groups": config.streamer_groups,
                "history_limit": config.history_limit,
                "snapshot_limit": config.snapshot_limit,
                "alert_thresholds": config.alert_thresholds,
            }
        )

    @app.get("/api/analytics/overview")
    def analytics_overview() -> Any:
        try:
            dashboard = service.get_dashboard()
            return jsonify(
                {
                    "generated_at": dashboard["generated_at"],
                    "overview": dashboard["overview"],
                    "group_summary": dashboard["group_summary"],
                    "category_mix": dashboard["category_mix"],
                }
            )
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    @app.get("/api/analytics/leaderboards")
    def analytics_leaderboards() -> Any:
        try:
            dashboard = service.get_dashboard()
            return jsonify(
                {
                    "generated_at": dashboard["generated_at"],
                    "leaderboards": dashboard["leaderboards"],
                }
            )
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    @app.get("/api/analytics/compare")
    def analytics_compare() -> Any:
        requested = request.args.get("logins")
        logins = parse_streamers(requested) if requested else config.streamers[:4]
        try:
            return jsonify(service.compare_streamers(logins))
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    @app.get("/api/analytics/stream/<login>")
    def analytics_stream(login: str) -> Any:
        try:
            return jsonify(service.get_analytics_stream(login.lower()))
        except requests.RequestException as exc:
            app.logger.exception("Twitch request failed")
            return jsonify({"error": "twitch_request_failed", "detail": str(exc)}), 502
        except RuntimeError as exc:
            return jsonify({"error": "configuration_error", "detail": str(exc)}), 503

    return app


app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = parse_int(os.getenv("PORT", "5050"), 5050)
    print(f"Twitch Live Radar is running on {host}:{port}")
    print("Use twitch_checker/config.json or .env to add real Twitch credentials.")
    app.run(host=host, port=port, debug=False)


