"""
====================================================
 KAI CENAT LIVE CHECKER — BACKEND ENGINE (v3.0)
====================================================
Exposes a local HTTP API for a static website.
====================================================
"""

import requests
import json
from datetime import datetime
from typing import Dict
import logging
from dataclasses import dataclass
from pathlib import Path

from flask import Flask, jsonify

# ---------------------- DATA ----------------------
@dataclass
class StreamInfo:
    user_name: str
    user_login: str
    title: str
    game_name: str
    viewer_count: int
    started_at: str
    is_live: bool

# ---------------------- APP ----------------------
app = Flask(__name__)

class TwitchLiveChecker:
    def __init__(self, config_path: str = "config.json"):
        self.config_path = Path(config_path)
        self.config = self.load_config()
        self.logger = self.setup_logging()
        self.access_token = None
        self.authenticate()

    # ---------------- CONFIG ----------------
    def load_config(self) -> Dict:
        defaults = {
            "client_id": "YOUR_CLIENT_ID",
            "client_secret": "YOUR_CLIENT_SECRET"
        }

        if self.config_path.exists():
            defaults.update(json.loads(self.config_path.read_text()))
        else:
            self.config_path.write_text(json.dumps(defaults, indent=2))
            print("📝 config.json created — add Twitch credentials")

        return defaults

    # ---------------- LOGGING ----------------
    def setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s — %(levelname)s — %(message)s"
        )
        return logging.getLogger("TwitchChecker")

    # ---------------- AUTH ----------------
    def authenticate(self):
        r = requests.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": self.config["client_id"],
                "client_secret": self.config["client_secret"],
                "grant_type": "client_credentials"
            },
            timeout=10
        )
        r.raise_for_status()
        self.access_token = r.json()["access_token"]
        self.logger.info("✅ Authenticated with Twitch")

    def headers(self):
        return {
            "Client-ID": self.config["client_id"],
            "Authorization": f"Bearer {self.access_token}"
        }

    # ---------------- CORE ----------------
    def check_stream(self, username: str) -> StreamInfo:
        r = requests.get(
            "https://api.twitch.tv/helix/streams",
            headers=self.headers(),
            params={"user_login": username},
            timeout=8
        )
        r.raise_for_status()
        data = r.json().get("data", [])

        if not data:
            return StreamInfo(username, username, "", "", 0, "", False)

        d = data[0]
        return StreamInfo(
            user_name=d["user_name"],
            user_login=d["user_login"],
            title=d["title"],
            game_name=d["game_name"],
            viewer_count=d["viewer_count"],
            started_at=d["started_at"],
            is_live=True
        )

    def format_uptime(self, started_at: str) -> str:
        if not started_at:
            return "0m"
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        diff = datetime.now(start.tzinfo) - start
        minutes = int(diff.total_seconds() // 60)
        h, m = divmod(minutes, 60)
        return f"{h}h {m}m" if h else f"{m}m"

checker = TwitchLiveChecker()

# ---------------- API ----------------
@app.route("/api/live/<username>")
def api_live(username):
    info = checker.check_stream(username)

    if not info.is_live:
        return jsonify({"live": False})

    return jsonify({
        "live": True,
        "user": info.user_login,
        "title": info.title,
        "game": info.game_name,
        "viewers": info.viewer_count,
        "uptime": checker.format_uptime(info.started_at)
    })

# ---------------- ENTRY ----------------
if __name__ == "__main__":
    print("🚀 Backend API running at http://localhost:5050")
    app.run(port=5050)

