from __future__ import annotations

import json
import logging
import os
import secrets
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory

BASE_DIR = Path(__file__).resolve().parent.parent
PACKAGE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = PACKAGE_DIR / "config.json"
SAMPLE_CONFIG_PATH = PACKAGE_DIR / "config.sample.json"
DATA_DIR = BASE_DIR / "data"
STATE_PATH = DATA_DIR / "stream_state.json"
DEFAULT_TIMEOUT = 12
TWITCH_OAUTH_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_API_BASE = "https://api.twitch.tv/helix"


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
    hours, mins = divmod(minutes, 60)
    if hours >= 24:
        days, rem_hours = divmod(hours, 24)
        return f"{days}d {rem_hours}h {mins}m"
    if hours:
        return f"{hours}h {mins}m"
    return f"{mins}m"


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
        return ["kaicenat"]
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
    return normalized or ["kaicenat"]


@dataclass
class AppConfig:
    client_id: str
    client_secret: str
    streamers: list[str]
    check_interval: int
    discord_webhook: str
    enable_discord_notifications: bool
    history_limit: int
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

    client_id = os.getenv("TWITCH_CLIENT_ID", file_config.get("client_id", "")).strip()
    client_secret = os.getenv("TWITCH_CLIENT_SECRET", file_config.get("client_secret", "")).strip()
    streamers = parse_streamers(os.getenv("TWITCH_STREAMERS", file_config.get("streamers")))
    check_interval = parse_int(os.getenv("CHECK_INTERVAL", file_config.get("check_interval", 60)), 60)
    discord_webhook = os.getenv("DISCORD_WEBHOOK", file_config.get("discord_webhook", "")).strip()
    enable_discord = str(
        os.getenv(
            "ENABLE_DISCORD_NOTIFICATIONS",
            file_config.get("enable_discord_notifications", False),
        )
    ).lower() in {"1", "true", "yes", "on"}
    history_limit = parse_int(os.getenv("HISTORY_LIMIT", file_config.get("history_limit", 8)), 8)
    frontend_title = os.getenv("FRONTEND_TITLE", file_config.get("frontend_title", "Twitch Live Radar")).strip()
    flask_secret = os.getenv("FLASK_SECRET_KEY", secrets.token_urlsafe(32))

    return AppConfig(
        client_id=client_id,
        client_secret=client_secret,
        streamers=streamers,
        check_interval=max(check_interval, 15),
        discord_webhook=discord_webhook,
        enable_discord_notifications=enable_discord,
        history_limit=max(history_limit, 1),
        frontend_title=frontend_title or "Twitch Live Radar",
        flask_secret_key=flask_secret,
    )


@dataclass
class StreamRecord:
    login: str
    display_name: str
    is_live: bool
    title: str
    game_name: str
    viewer_count: int
    started_at: str | None
    uptime: str
    profile_image_url: str
    offline_image_url: str
    thumbnail_url: str
    url: str
    description: str
    broadcaster_type: str
    last_seen_at: str
    recent_sessions: list[dict[str, Any]]


class StreamStateStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.state = self._load_state()

    def _default_state(self) -> dict[str, Any]:
        return {"streams": {}, "history": {}}

    def _load_state(self) -> dict[str, Any]:
        data = load_json_file(self.path)
        if "streams" not in data or "history" not in data:
            return self._default_state()
        return data

    def _save(self) -> None:
        self.path.write_text(json.dumps(self.state, indent=2), encoding="utf-8")

    def recent_sessions(self, login: str, limit: int) -> list[dict[str, Any]]:
        history = self.state.get("history", {}).get(login, [])
        return list(reversed(history[-limit:]))

    def update(self, login: str, is_live: bool, started_at: str | None, title: str) -> str | None:
        with self.lock:
            stream_state = self.state.setdefault("streams", {})
            history_state = self.state.setdefault("history", {})
            previous = stream_state.get(login, {"is_live": False})
            now_iso = utc_now_iso()
            event: str | None = None

            if is_live:
                session_started_at = started_at or previous.get("session_started_at") or now_iso
                stream_state[login] = {
                    "is_live": True,
                    "session_started_at": session_started_at,
                    "last_seen_at": now_iso,
                    "title": title,
                }
                if not previous.get("is_live"):
                    event = "went_live"
            else:
                if previous.get("is_live"):
                    history_state.setdefault(login, []).append(
                        {
                            "started_at": previous.get("session_started_at"),
                            "ended_at": now_iso,
                            "title": previous.get("title", ""),
                        }
                    )
                    event = "went_offline"
                stream_state[login] = {
                    "is_live": False,
                    "session_started_at": None,
                    "last_seen_at": now_iso,
                    "title": title,
                }

            self._save()
            return event


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
        live_count = 0
        for login in requested_logins:
            user = users.get(login, {})
            stream = streams.get(login, {})
            is_live = bool(stream)
            event = self.state_store.update(
                login=login,
                is_live=is_live,
                started_at=stream.get("started_at"),
                title=stream.get("title", ""),
            )

            if event == "went_live":
                self._send_discord_notification(login, user, stream)

            record = StreamRecord(
                login=login,
                display_name=user.get("display_name", login),
                is_live=is_live,
                title=stream.get("title", ""),
                game_name=stream.get("game_name", ""),
                viewer_count=stream.get("viewer_count", 0),
                started_at=stream.get("started_at"),
                uptime=format_uptime(stream.get("started_at")),
                profile_image_url=user.get("profile_image_url", ""),
                offline_image_url=user.get("offline_image_url", ""),
                thumbnail_url=flatten_thumbnail(stream.get("thumbnail_url")),
                url=f"https://www.twitch.tv/{login}",
                description=user.get("description", ""),
                broadcaster_type=user.get("broadcaster_type", ""),
                last_seen_at=utc_now_iso(),
                recent_sessions=self.state_store.recent_sessions(login, self.config.history_limit),
            )
            cards.append(asdict(record))
            if is_live:
                live_count += 1

        return {
            "generated_at": utc_now_iso(),
            "title": self.config.frontend_title,
            "check_interval": self.config.check_interval,
            "streamers": cards,
            "summary": {
                "tracked": len(cards),
                "live": live_count,
                "offline": max(len(cards) - live_count, 0),
            },
        }

    def get_stream(self, login: str) -> dict[str, Any]:
        return self.get_dashboard([login])["streamers"][0]

    def _fetch_users(self, logins: list[str]) -> dict[str, dict[str, Any]]:
        payload = self._request("users", [("login", login) for login in logins])
        return {item["login"].lower(): item for item in payload.get("data", [])}

    def _fetch_streams(self, logins: list[str]) -> dict[str, dict[str, Any]]:
        payload = self._request("streams", [("user_login", login) for login in logins])
        return {item["user_login"].lower(): item for item in payload.get("data", [])}

    def _send_discord_notification(
        self,
        login: str,
        user: dict[str, Any],
        stream: dict[str, Any],
    ) -> None:
        if not self.config.enable_discord_notifications or not self.config.discord_webhook:
            return

        content = {
            "embeds": [
                {
                    "title": f"{user.get('display_name', login)} just went live",
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
        return send_from_directory(BASE_DIR, "kaiCent.html")

    @app.get("/kaiCenat.css")
    def stylesheet() -> Any:
        return send_from_directory(BASE_DIR, "kaiCenat.css")

    @app.get("/kaiCenat.js")
    def script() -> Any:
        return send_from_directory(BASE_DIR, "kaiCenat.js")

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
        try:
            return jsonify(service.get_dashboard())
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
            }
        )

    @app.get("/api/config")
    def frontend_config() -> Any:
        return jsonify(
            {
                "title": config.frontend_title,
                "check_interval": config.check_interval,
                "streamers": config.streamers,
                "history_limit": config.history_limit,
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = parse_int(os.getenv("PORT", "5050"), 5050)
    print(f"Twitch Live Radar is running on {host}:{port}")
    print("Use twitch_checker/config.json or .env to add real Twitch credentials.")
    app.run(host=host, port=port, debug=False)


