import requests
import time
import json
import os
from datetime import datetime
from typing import Dict, Optional
import logging
from dataclasses import dataclass
from pathlib import Path

try:
    from plyer import notification
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    print("Install 'plyer' for desktop notifications: pip install plyer")


@dataclass
class StreamInfo:
    """Data class to store stream information"""
    user_name: str
    user_login: str
    title: str
    game_name: str
    viewer_count: int
    started_at: str
    thumbnail_url: str
    is_live: bool


class TwitchLiveChecker:
    """
    Advanced Twitch Live Checker
    Monitors multiple Twitch streamers and sends notifications when they go live
    """

    def __init__(self, config_path: str = "config.json"):
        self.config_path = Path(config_path)
        self.config = self.load_config()
        self.setup_logging()
        self.access_token = None
        self.stream_status = {}
        self.authenticate()

    def load_config(self) -> Dict:
        """Load configuration from JSON file or create default"""
        default_config = {
            "client_id": "YOUR_CLIENT_ID_HERE",
            "client_secret": "YOUR_CLIENT_SECRET_HERE",
            "streamers": ["kaicenat"],
            "check_interval": 60,
            "discord_webhook": "",
            "enable_desktop_notifications": True,
            "enable_discord_notifications": False,
            "log_level": "INFO"
        }
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                config = json.load(f)
                default_config.update(config)
                return default_config
        else:
            with open(self.config_path, 'w') as f:
                json.dump(default_config, f, indent=4)
            print(f"Created default config file: {self.config_path}")
            return default_config

    def setup_logging(self):
        """Setup logging configuration"""
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        log_level = getattr(logging, self.config.get("log_level", "INFO"), logging.INFO)
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / "twitch_checker.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("TwitchChecker")

    def authenticate(self):
        """Authenticate with Twitch API using OAuth Client Credentials flow"""
        url = "https://id.twitch.tv/oauth2/token"
        params = {
            "client_id": self.config["client_id"],
            "client_secret": self.config["client_secret"],
            "grant_type": "client_credentials"
        }
        response = requests.post(url, params=params)
        response.raise_for_status()
        data = response.json()
        self.access_token = data["access_token"]
        self.logger.info("Authenticated with Twitch API")

    def get_headers(self) -> Dict[str, str]:
        """Get headers for Twitch API requests"""
        return {
            "Client-ID": self.config["client_id"],
            "Authorization": f"Bearer {self.access_token}"
        }

    def check_stream_status(self, username: str) -> Optional[StreamInfo]:
        """Check if a streamer is currently live"""
        url = "https://api.twitch.tv/helix/streams"
        params = {"user_login": username}
        response = requests.get(url, headers=self.get_headers(), params=params)
        response.raise_for_status()
        data = response.json()
        if data["data"]:
            d = data["data"][0]
            return StreamInfo(
                user_name=d["user_name"],
                user_login=d["user_login"],
                title=d["title"],
                game_name=d["game_name"],
                viewer_count=d["viewer_count"],
                started_at=d["started_at"],
                thumbnail_url=d["thumbnail_url"],
                is_live=True
            )
        else:
            return StreamInfo(
                user_name=username,
                user_login=username,
                title="",
                game_name="",
                viewer_count=0,
                started_at="",
                thumbnail_url="",
                is_live=False
            )

    def send_desktop_notification(self, stream_info: StreamInfo):
        """Send desktop notification when streamer goes live"""
        if not NOTIFICATIONS_AVAILABLE or not self.config.get("enable_desktop_notifications"):
            return
        try:
            notification.notify(
                title=f"{stream_info.user_name} is LIVE! 🔴",
                message=f"Playing: {stream_info.game_name}\n{stream_info.title}",
                app_name="Twitch Live Checker",
                timeout=10
            )
        except Exception as e:
            self.logger.error(f"Notification error: {e}")

    def send_discord_webhook(self, stream_info: StreamInfo):
        """Send Discord webhook notification when streamer goes live"""
        webhook_url = self.config.get("discord_webhook", "")
        if not webhook_url or not self.config.get("enable_discord_notifications"):
            return
        payload = {
            "content": f"@everyone {stream_info.user_name} just went live!",
            "embeds": [{
                "title": f"{stream_info.user_name} is LIVE! 🔴",
                "description": stream_info.title,
                "url": f"https://twitch.tv/{stream_info.user_login}",
                "color": 0x9147FF
            }]
        }
        try:
            requests.post(webhook_url, json=payload)
        except Exception as e:
            self.logger.error(f"Discord webhook error: {e}")

    def log_stream_event(self, stream_info: StreamInfo, event_type: str):
        """Log stream events to a file"""
        log_dir = Path("stream_logs")
        log_dir.mkdir(exist_ok=True)
        file = log_dir / f"{stream_info.user_login}_history.json"
        event = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "title": stream_info.title,
            "game": stream_info.game_name,
            "viewers": stream_info.viewer_count
        }
        if file.exists():
            with open(file, 'r') as f:
                logs = json.load(f)
        else:
            logs = []
        logs.append(event)
        with open(file, 'w') as f:
            json.dump(logs[-100:], f, indent=2)

    def format_uptime(self, started_at: str) -> str:
        """Calculate and format stream uptime"""
        if not started_at:
            return "0m"
        start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
        delta = datetime.now(start.tzinfo) - start
        h = int(delta.total_seconds() // 3600)
        m = int((delta.total_seconds() % 3600) // 60)
        return f"{h}h {m}m" if h else f"{m}m"

    def monitor_streamers(self):
        """Main monitoring loop"""
        self.logger.info("Starting Twitch Live Checker...")
        for s in self.config["streamers"]:
            self.stream_status[s] = False
        try:
            while True:
                for streamer in self.config["streamers"]:
                    stream_info = self.check_stream_status(streamer)
                    if not stream_info:
                        continue
                    was_live = self.stream_status.get(streamer, False)
                    is_live = stream_info.is_live

                    if is_live and not was_live:
                        self.logger.info(f"🔴 {stream_info.user_name} is now LIVE!")
                        self.logger.info(f"   Title: {stream_info.title}")
                        self.logger.info(f"   Game: {stream_info.game_name}")
                        self.logger.info(f"   Viewers: {stream_info.viewer_count}")
                        self.send_desktop_notification(stream_info)
                        self.send_discord_webhook(stream_info)
                        self.log_stream_event(stream_info, "went_live")

                    elif is_live and was_live:
                        uptime = self.format_uptime(stream_info.started_at)
                        self.logger.info(f"✓ {stream_info.user_name} - Live for {uptime} - {stream_info.viewer_count} viewers")

                    elif not is_live and was_live:
                        self.logger.info(f"⚫ {stream_info.user_name} went offline")
                        self.log_stream_event(stream_info, "went_offline")

                    else:
                        self.logger.debug(f"⚫ {stream_info.user_name} is offline")

                    self.stream_status[streamer] = is_live

                time.sleep(self.config["check_interval"])
        except KeyboardInterrupt:
            self.logger.info("\nStopping Twitch Live Checker...")
        except Exception as e:
            self.logger.error(f"Unexpected error: {e}", exc_info=True)


def main():
    """Main entry point"""
    print("=" * 60)
    print("          TWITCH LIVE CHECKER v2.0")
    print("=" * 60)
    print("\nSetup Instructions:")
    print("1. Go to https://dev.twitch.tv/console/apps")
    print("2. Create a new application")
    print("3. Copy your Client ID and Client Secret")
    print("4. Update config.json with your credentials")
    print("5. Add streamers you want to monitor")
    print("\nOptional: pip install plyer (for desktop notifications)")
    print("=" * 60)
    print()

    checker = TwitchLiveChecker()
    if checker.config["client_id"] == "YOUR_CLIENT_ID_HERE":
        print("⚠️  Please update config.json with your Twitch API credentials!")
        return
    checker.monitor_streamers()


if __name__ == "__main__":
    main()
