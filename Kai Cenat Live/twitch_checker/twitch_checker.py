"""
====================================================
 KAI CENAT LIVE CHECKER — BACKEND ENGINE (v3.1)
====================================================
• Exposes a local HTTP API for a static website
• Handles CORS for browsers
• Automatically refreshes Twitch tokens
• Shields against Twitch outages
• Gunicorn / production compatible
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
from flask_cors import CORS

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
CORS(app)  # ✅ Browser-safe

# ---------------------- CORE CLASS ----------------------
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
        self.logger.info("🔑 Authenticating with Twitch…")
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
        self.logger.info("✅ Twitch authentication successful")

    def headers(self):
        return {
            "Client-ID": self.config["client_id"],
            "Authorization": f"Bearer {self.access_token}"
        }

    # ---------------- CORE ----------------
    def check_stream(self, username: str) -> StreamInfo:
        try:
            r = requests.get(
                "https://api.twitch.tv/helix/streams",
                headers=self.headers(),
                params={"user_login": username},
                timeout=8
            )

            # 🔁 Token expired → refresh once
            if r.status_code == 401:
                self.logger.warning("♻️ Twitch token expired — refreshing")
                self.authenticate()
                r = requests.get(
                    "https://api.twitch.tv/helix/streams",
                    headers=self.headers(),
                    params={"user_login": username},
                    timeout=8
                )

            r.raise_for_status()
            data = r.json().get("data", [])

        except requests.RequestException as e:
            self.logger.error(f"❌ Twitch API error: {e}")
            return StreamInfo(username, username, "", "", 0, "", False)

        if not data:
            return StreamInfo(username, username, "", "", 0, "", False)

        d = data[0]
        return StreamInfo(
            user_name=d.get("user_name", username),
            user_login=d.get("user_login", username),
            title=d.get("title", ""),
            game_name=d.get("game_name", ""),
            viewer_count=d.get("viewer_count", 0),
            started_at=d.get("started_at", ""),
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
    try:
        info = checker.check_stream(username)
    except Exception as e:
        checker.logger.error(f"🔥 Backend failure: {e}")
        return jsonify({"live": False, "error": "backend_failure"}), 500

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
    app.run(host="0.0.0.0", port=5050)



