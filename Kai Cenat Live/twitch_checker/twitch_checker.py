"""
====================================================
 KAI CENAT LIVE CHECKER — BACKEND ENGINE (v4.0)
====================================================
• Exposes a local HTTP API for a static website
• Handles CORS for browsers
• Automatically refreshes Twitch tokens
• Shields against Twitch outages
• OAuth support for user login
• Session management
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

from flask import Flask, jsonify, redirect, request, session
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
app.secret_key = 'your-secret-key-change-this-to-something-random'  # ⚠️ Change in production!
CORS(app, supports_credentials=True, origins=["http://localhost:*", "http://127.0.0.1:*"])

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
            "client_secret": "YOUR_CLIENT_SECRET",
            "redirect_uri": "http://localhost:5050/auth/callback"
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
        """App authentication (client credentials) for checking any stream"""
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

    def headers(self, user_token=None):
        """Returns headers - use user_token if provided for user-specific calls, otherwise app token"""
        token = user_token if user_token else self.access_token
        return {
            "Client-ID": self.config["client_id"],
            "Authorization": f"Bearer {token}"
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

    def get_user_info(self, user_token: str):
        """Get user info from Twitch using user's OAuth token"""
        try:
            r = requests.get(
                "https://api.twitch.tv/helix/users",
                headers=self.headers(user_token),
                timeout=8
            )
            r.raise_for_status()
            data = r.json().get("data", [])
            return data[0] if data else None
        except requests.RequestException as e:
            self.logger.error(f"❌ Get user error: {e}")
            return None

checker = TwitchLiveChecker()

# ---------------- API ENDPOINTS ----------------
@app.route("/api/live/<username>")
def api_live(username):
    """Check if a Twitch user is live"""
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

@app.route("/api/me")
def api_me():
    """Check if user is logged in and return their info"""
    if 'user_token' not in session or 'user_info' not in session:
        return jsonify({"logged_in": False})
    
    return jsonify({
        "logged_in": True,
        "user": session['user_info']
    })

@app.route("/auth/twitch")
def auth_twitch():
    """Redirect to Twitch OAuth login page"""
    params = {
        "client_id": checker.config["client_id"],
        "redirect_uri": checker.config["redirect_uri"],
        "response_type": "code",
        "scope": "user:read:email"
    }
    url = "https://id.twitch.tv/oauth2/authorize?" + "&".join([f"{k}={v}" for k, v in params.items()])
    return redirect(url)

@app.route("/auth/callback")
def auth_callback():
    """Handle Twitch OAuth callback and exchange code for token"""
    code = request.args.get('code')
    if not code:
        return "Error: No code provided", 400
    
    # Exchange authorization code for access token
    try:
        r = requests.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": checker.config["client_id"],
                "client_secret": checker.config["client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": checker.config["redirect_uri"]
            },
            timeout=10
        )
        r.raise_for_status()
        token_data = r.json()
        
        # Get user info using the access token
        user_info = checker.get_user_info(token_data['access_token'])
        if user_info:
            session['user_token'] = token_data['access_token']
            session['user_info'] = user_info
            checker.logger.info(f"✅ User {user_info['login']} logged in")
        
        # Redirect back to frontend (adjust port if needed)
        return redirect("http://localhost:8000")
    
    except requests.RequestException as e:
        checker.logger.error(f"❌ OAuth error: {e}")
        return f"Error during authentication: {e}", 500

@app.route("/auth/logout")
def auth_logout():
    """Logout user and clear session"""
    session.clear()
    return jsonify({"success": True})

# ---------------- ENTRY ----------------
if __name__ == "__main__":
    print("🚀 Backend API running at http://localhost:5050")
    print("📝 Make sure to update config.json with your Twitch credentials")
    print("   Get credentials from: https://dev.twitch.tv/console/apps")
    app.run(host="0.0.0.0", port=5050, debug=True)




