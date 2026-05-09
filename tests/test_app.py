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

SAMPLE_COMMAND_CENTER = {
    "generated_at": "2026-04-06T12:00:00+00:00",
    "posture": "Watch",
    "posture_score": 47,
    "operation_brief": "One creator is live and the watchlist is stable.",
    "system_checks": [{"name": "Twitch credentials", "status": "healthy", "detail": "Connected."}],
    "risk_register": [{"name": "Kai Cenat", "status": "medium", "detail": "Audience is running near peak."}],
    "zone_status": [{"name": "Overview", "status": "healthy", "detail": "Overview is online."}],
    "watchlist_pulse": [{"login": "kaicenat", "display_name": "Kai Cenat", "status": "live", "value": 12345, "detail": "Live viewers."}],
    "event_counts": {"high": 0, "medium": 1, "low": 0},
}

SAMPLE_WORKSPACE = {
    "generated_at": "2026-04-06T12:00:00+00:00",
    "payload_version": "workspace.v1",
    "config": {"title": "Audience Signal Lab", "check_interval": 60, "streamers": ["kaicenat"], "streamer_groups": {}, "history_limit": 12, "snapshot_limit": 72, "alert_thresholds": [1000]},
    "health": {"ok": True, "configured": True, "error": None, "generated_at": "2026-04-06T12:00:00+00:00", "cache_age_seconds": 3},
    "dashboard": SAMPLE_DASHBOARD,
    "command_center": SAMPLE_COMMAND_CENTER,
    "anomaly_summary": {"generated_at": "2026-04-06T12:00:00+00:00", "tracked": 1, "active_anomalies": [], "recent_events": [], "counts": {"high": 0, "medium": 0, "watch": 0}},
    "selected_streamer": SAMPLE_DASHBOARD["streamers"][0],
    "integration": {"recommended_refresh_seconds": 60, "supports_search": True, "supports_forecast": True, "primary_routes": {"workspace": "/api/workspace"}},
}

SAMPLE_ANOMALIES = {
    "generated_at": "2026-04-06T12:00:00+00:00",
    "tracked": 1,
    "active_anomalies": [{"login": "kaicenat", "display_name": "Kai Cenat", "severity": "high", "reason": "Trend score is elevated at 180.", "viewer_count": 12345, "trend_score": 180, "consistency_score": 72}],
    "recent_events": [],
    "counts": {"high": 1, "medium": 0, "watch": 0},
}

SAMPLE_COMPARE_SUMMARY = {
    "generated_at": "2026-04-06T12:00:00+00:00",
    "streamers": [{"login": "kaicenat", "display_name": "Kai Cenat", "is_live": True, "viewer_count": 12345, "session_count": 4, "avg_duration_minutes": 160, "best_peak_viewers": 20000, "avg_peak_viewers": 15000, "trend_score": 110, "top_category": "Just Chatting", "consistency_score": 72}],
    "leaders": {"live_viewers": {"login": "kaicenat"}, "peak_viewers": {"login": "kaicenat"}, "consistency": {"login": "kaicenat"}, "momentum": {"login": "kaicenat"}},
    "summary": {"tracked": 1, "live": 1, "avg_trend_score": 110, "avg_consistency_score": 72},
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

    def test_command_center_route_uses_service_payload(self) -> None:
        with patch.object(TwitchService, "get_command_center", return_value=SAMPLE_COMMAND_CENTER):
            app = create_app()
            client = app.test_client()

            response = client.get("/api/command-center")
            payload = response.get_json()

            self.assertEqual(response.status_code, 200)
            self.assertEqual(payload["posture"], "Watch")
            self.assertEqual(payload["watchlist_pulse"][0]["login"], "kaicenat")

    def test_workspace_route_uses_service_payload(self) -> None:
        with patch.object(TwitchService, "get_workspace_bundle", return_value=SAMPLE_WORKSPACE):
            app = create_app()
            client = app.test_client()

            response = client.get("/api/workspace?selected=kaicenat")
            payload = response.get_json()

            self.assertEqual(response.status_code, 200)
            self.assertEqual(payload["payload_version"], "workspace.v1")
            self.assertEqual(payload["selected_streamer"]["login"], "kaicenat")

    def test_workspace_route_falls_back_without_credentials(self) -> None:
        app = create_app()
        client = app.test_client()

        response = client.get("/api/workspace")
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["payload_version"], "workspace.v1")
        self.assertFalse(payload["health"]["configured"])
        self.assertIn("anomaly_summary", payload)
        self.assertEqual(payload["anomaly_summary"]["counts"]["high"], 0)

    def test_analysis_and_schema_routes(self) -> None:
        with patch.object(TwitchService, "get_anomaly_summary", return_value=SAMPLE_ANOMALIES), patch.object(
            TwitchService, "get_compare_summary", return_value=SAMPLE_COMPARE_SUMMARY
        ), patch.object(
            TwitchService, "get_api_schema", return_value={"openapi": "3.0.0", "info": {"title": "Audience Operations API"}}
        ):
            app = create_app()
            client = app.test_client()

            anomalies_response = client.get("/api/anomalies")
            compare_response = client.get("/api/compare/summary?logins=kaicenat")
            schema_response = client.get("/api/openapi.json")

            self.assertEqual(anomalies_response.status_code, 200)
            self.assertEqual(anomalies_response.get_json()["counts"]["high"], 1)
            self.assertEqual(compare_response.status_code, 200)
            self.assertEqual(compare_response.get_json()["leaders"]["momentum"]["login"], "kaicenat")
            self.assertEqual(schema_response.status_code, 200)
            self.assertEqual(schema_response.get_json()["openapi"], "3.0.0")

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
