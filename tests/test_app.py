from __future__ import annotations

import unittest
from unittest.mock import patch

from twitch_checker.twitch_checker import TwitchService, create_app


SAMPLE_DASHBOARD = {
    "generated_at": "2026-04-06T12:00:00+00:00",
    "title": "Audience Signal Lab",
    "check_interval": 60,
    "summary": {"tracked": 1, "live": 1, "offline": 0, "current_viewers": 12345},
    "overview": {"dominant_category": "Just Chatting"},
    "leaderboards": {"live_now": [], "best_peak": [], "most_active": [], "trend": []},
    "group_summary": [],
    "category_mix": [],
    "alerts": [],
    "streamers": [
        {
            "login": "kaicenat",
            "display_name": "Kai Cenat",
            "is_live": True,
            "viewer_count": 12345,
            "title": "Live show",
            "game_name": "Just Chatting",
            "url": "https://www.twitch.tv/kaicenat",
            "description": "Example",
            "uptime": "2h 10m",
            "groups": ["Featured"],
            "recent_sessions": [],
            "recent_snapshots": [],
            "analytics": {
                "session_count": 4,
                "avg_duration_minutes": 160,
                "best_peak_viewers": 20000,
                "consistency_score": 72,
                "trend_score": 110,
                "top_category": "Just Chatting",
            },
        }
    ],
}


class AppRoutesTest(unittest.TestCase):
    def test_health_route_returns_status_payload(self) -> None:
        app = create_app()
        client = app.test_client()

        response = client.get("/api/health")
        payload = response.get_json()

        self.assertIn(response.status_code, (200, 503))
        self.assertIn("configured", payload)
        self.assertIn("generated_at", payload)

    def test_dashboard_route_uses_service_payload(self) -> None:
        with patch.object(TwitchService, "get_dashboard", return_value=SAMPLE_DASHBOARD):
            app = create_app()
            client = app.test_client()

            response = client.get("/api/dashboard")
            payload = response.get_json()

            self.assertEqual(response.status_code, 200)
            self.assertEqual(payload["title"], "Audience Signal Lab")
            self.assertEqual(payload["streamers"][0]["login"], "kaicenat")

    def test_search_and_watchlist_routes(self) -> None:
        with patch.object(
            TwitchService,
            "search_streamers",
            return_value=[
                {
                    "login": "kaicenat",
                    "display_name": "Kai Cenat",
                    "profile_image_url": "",
                    "game_name": "Just Chatting",
                    "is_live": True,
                    "is_tracked": False,
                }
            ],
        ), patch.object(
            TwitchService,
            "add_streamer",
            return_value={"streamers": ["kaicenat"], "streamer_groups": {}, "title": "Audience Signal Lab", "check_interval": 60},
        ), patch.object(
            TwitchService,
            "remove_streamer",
            return_value={"streamers": [], "streamer_groups": {}, "title": "Audience Signal Lab", "check_interval": 60},
        ):
            app = create_app()
            client = app.test_client()

            search_response = client.get("/api/search?q=kai")
            self.assertEqual(search_response.status_code, 200)
            self.assertEqual(search_response.get_json()[0]["login"], "kaicenat")

            add_response = client.post("/api/watchlist", json={"login": "kaicenat"})
            self.assertEqual(add_response.status_code, 201)
            self.assertEqual(add_response.get_json()["streamers"], ["kaicenat"])

            remove_response = client.delete("/api/watchlist/kaicenat")
            self.assertEqual(remove_response.status_code, 200)
            self.assertEqual(remove_response.get_json()["streamers"], [])


if __name__ == "__main__":
    unittest.main()
