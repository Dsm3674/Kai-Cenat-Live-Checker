"""
====================================================
 KAI CENAT LIVE CHECKER — BACKEND ENGINE (v2.5)
====================================================
A Python tool to monitor Twitch streamers (like Kai Cenat)
and send instant notifications when they go live.

Features:
  • Multi-streamer monitoring
  • Desktop + Discord alerts
  • Event logging and uptime tracking
  • Cross-platform support

Author: Divyanshu Matam Somasekhar (Dsm3674)
====================================================
"""

import requests
import time
import json
import os
from datetime import datetime
from typing import Dict, Optional
import logging
from dataclasses import dataclass
from pathlib import Path

# Optional desktop notifications
try:
    from plyer import notification
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    print("⚠️  Install 'plyer' for desktop notifications: pip install plyer")


@dataclass
class StreamInfo:
    """Structured Twitch stream data"""
    user_name: str
    user_login: str
    title: str
    game_name: str
    viewer_count: int
    started_at: str
    thumbnail_url: str
    is_live: bool


class TwitchLiveChecker:
    """Main Twitch monitoring engine"""

    def __init__(self, config_path: str = "config.json"):
        self.config_path = Path(config_path)
        self.config = self.load_config()
        self.logger = self.setup_logging()
        self.access_token = None
        self.stream_status = {}
        self.authenticate()

    # ---------------------- CONFIG ----------------------
    def load_config(self) -> Dict:
        """Load configuration or create a default one"""
        defaults = {
            "client_id": "YOUR_CLIENT_ID_HERE",
            "client_secret": "YOUR_CLIENT_SECRET_HERE",
            "streamers": ["kaicenat"],
            "check_interval": 60,
            "discord_webhook": "",
            "enable_desktop_notifications": True,
            "enable_discord_notifications": False,
            "log_level": "INFO"
        }

        if self.config_path.exists():
            with open(self.config_path, "r") as f:
                user_cfg = json.load(f)
            defaults.update(user_cfg)
        else:
            with open(self.config_path, "w") as f:
                json.dump(defaults, f, indent=4)
            print(f"📝 Created default config at {self.config_path}")
        return defaults

    # ---------------------- LOGGING ----------------------
    def setup_logging(self):
        """Configure logger for console + file output"""
        logs_dir = Path("logs")
        logs_dir.mkdir(exist_ok=True)
        level = getattr(logging, self.config.get("log_level", "INFO").upper(), logging.INFO)
        formatter = logging.Formatter("%(asctime)s — %(levelname)s — %(message)s")

        # File handler
        file_handler = logging.FileHandler(logs_dir / "twitch_checker.log", encoding="utf-8")
        file_handler.setFormatter(formatter)

        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)

        logger = logging.getLogger("TwitchChecker")
        logger.setLevel(level)
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        return logger

    # ---------------------- AUTH ----------------------
    def authenticate(self):
        """Authenticate via Twitch OAuth client credentials"""
        url = "https://id.twitch.tv/oauth2/token"
        params = {
            "client_id": self.config["client_id"],
            "client_secret": self.config["client_secret"],
            "grant_type": "client_credentials"
        }
        try:
            response = requests.post(url, params=params, timeout=10)
            response.raise_for_status()
            self.access_token = response.json()["access_token"]
            self.logger.info("✅ Successfully authenticated with Twitch API.")
        except Exception as e:
            self.logger.error("❌ Authentication failed. Check credentials.", exc_info=True)
            raise e

    def get_headers(self) -> Dict[str, str]:
        """Return standard Twitch headers"""
        return {
            "Client-ID": self.config["client_id"],
            "Authorization": f"Bearer {self.access_token}"
        }

    # ---------------------- CORE ----------------------
    def check_stream_status(self, username: str) -> Optional[StreamInfo]:
        """Query Twitch API for stream status"""
        url = "https://api.twitch.tv/helix/streams"
        try:
            resp = requests.get(url, headers=self.get_headers(), params={"user_login": username}, timeout=8)
            resp.raise_for_status()
            data = resp.json().get("data", [])
        except requests.RequestException as e:
            self.logger.error(f"Network error checking {username}: {e}")
            return None

        if not data:
            return StreamInfo(username, username, "", "", 0, "", "", False)

        d = data[0]
        return StreamInfo(
            user_name=d.get("user_name", username),
            user_login=d.get("user_login", username),
            title=d.get("title", ""),
            game_name=d.get("game_name", ""),
            viewer_count=d.get("viewer_count", 0),
            started_at=d.get("started_at", ""),
            thumbnail_url=d.get("thumbnail_url", ""),
            is_live=True
        )

    # ---------------------- NOTIFICATIONS ----------------------
    def send_desktop_notification(self, info: StreamInfo):
        """Pop a desktop notification"""
        if not (NOTIFICATIONS_AVAILABLE and self.config["enable_desktop_notifications"]):
            return
        try:
            notification.notify(
                title=f"🔴 {info.user_name} is LIVE!",
                message=f"{info.title} — {info.viewer_count} viewers\nPlaying: {info.game_name}",
                app_name="Twitch Live Checker",
                timeout=8
            )
        except Exception as e:
            self.logger.warning(f"Notification failed: {e}")

    def send_discord_webhook(self, info: StreamInfo):
        """Send a Discord webhook message"""
        if not (self.config["enable_discord_notifications"] and self.config["discord_webhook"]):
            return

        payload = {
            "content": f"@everyone **{info.user_name}** just went LIVE! 🔴",
            "embeds": [{
                "title": info.title or "Live Now!",
                "url": f"https://twitch.tv/{info.user_login}",
                "color": 0x9147FF,
                "fields": [
                    {"name": "Game", "value": info.game_name or "Unknown", "inline": True},
                    {"name": "Viewers", "value": str(info.viewer_count), "inline": True}
                ]
            }]
        }
        try:
            requests.post(self.config["discord_webhook"], json=payload, timeout=5)
        except Exception as e:
            self.logger.warning(f"Discord webhook error: {e}")

    # ---------------------- LOGGING ----------------------
    def log_stream_event(self, info: StreamInfo, event: str):
        """Save stream events to history JSON"""
        logs_dir = Path("stream_logs")
        logs_dir.mkdir(exist_ok=True)
        file = logs_dir / f"{info.user_login}_history.json"
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event,
            "title": info.title,
            "game": info.game_name,
            "viewers": info.viewer_count
        }
        try:
            if file.exists():
                with open(file, "r") as f:
                    existing = json.load(f)
            else:
                existing = []
        except json.JSONDecodeError:
            existing = []
        existing.append(entry)
        with open(file, "w") as f:
            json.dump(existing[-200:], f, indent=2)

    def format_uptime(self, started_at: str) -> str:
        """Return stream uptime as h/m"""
        if not started_at:
            return "0m"
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        diff = datetime.now(start.tzinfo) - start
        h, m = divmod(int(diff.total_seconds() // 60), 60)
        return f"{h}h {m}m" if h else f"{m}m"

    # ---------------------- MONITOR ----------------------
    def monitor_streamers(self):
        """Main monitoring loop"""
        self.logger.info("🚀 Twitch Live Checker started.")
        for s in self.config["streamers"]:
            self.stream_status[s] = False

        try:
            while True:
                for username in self.config["streamers"]:
                    info = self.check_stream_status(username)
                    if not info:
                        continue

                    prev_live = self.stream_status.get(username, False)
                    now_live = info.is_live

                    if now_live and not prev_live:
                        self.logger.info(f"🔴 {info.user_name} is now LIVE! ({info.viewer_count} viewers)")
                        self.logger.info(f"   Title: {info.title}")
                        self.logger.info(f"   Game: {info.game_name}")
                        self.send_desktop_notification(info)
                        self.send_discord_webhook(info)
                        self.log_stream_event(info, "went_live")

                    elif not now_live and prev_live:
                        self.logger.info(f"⚫ {info.user_name} went offline.")
                        self.log_stream_event(info, "went_offline")

                    elif now_live:
                        uptime = self.format_uptime(info.started_at)
                        self.logger.info(f"🟣 {info.user_name} — {uptime} — {info.viewer_count} viewers")

                    self.stream_status[username] = now_live

                time.sleep(self.config["check_interval"])

        except KeyboardInterrupt:
            self.logger.info("🛑 Stopped Twitch Live Checker manually.")
        except Exception as e:
            self.logger.error(f"Unexpected error: {e}", exc_info=True)

# ---------------------- MAIN ENTRY ----------------------
def main():
    print("=" * 60)
    print("💜  KAI CENAT LIVE CHECKER — BACKEND")
    print("=" * 60)
    print(" Monitors Twitch streamers & sends notifications.")
    print(" Edit config.json to customize streamers, intervals, or alerts.\n")

    checker = TwitchLiveChecker()
    if checker.config["client_id"].startswith("YOUR"):
        print("⚠️  Update config.json with your Twitch credentials before running!")
        return

    checker.monitor_streamers()


if __name__ == "__main__":
    main()
