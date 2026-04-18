# Audience Signal Lab

Audience Signal Lab is a Twitch analytics dashboard built with Flask, vanilla JavaScript, Chart.js, SQLite, and a lightweight ML layer. It tracks a watchlist of creators, stores local history, estimates short-horizon viewer peaks, flags unusual spikes, and now lets you watch the selected Twitch channel directly inside the app.

## What Improved

- Safer Flask static serving: only `/static` is public now
- Cached dashboard reads so one refresh powers multiple views instead of repeated Twitch calls
- Watchlist search, add, and remove controls from inside the UI
- Embedded Twitch player for the focused channel
- Cleaner SQLite session handling with thread-safe engine config
- Model diagnostics beyond a raw forecast: confidence label, MAE, and naive-baseline comparison
- Safer frontend rendering with DOM APIs instead of dynamic HTML string injection
- Reduced-motion support and better mobile handling

## Core Features

- Multi-streamer Twitch watchlist
- Real-time status, viewers, uptime, and category data
- Historical session and snapshot tracking
- Short-term peak forecasting with confidence diagnostics
- Z-score anomaly detection on viewer-count changes
- Group summaries, leaderboards, and creator drill-downs
- Embedded Twitch playback inside the dashboard
- Discord go-live notification hook

## Project Structure

```text
.
├── README.md
├── dashboard.html
├── requirements.txt
├── scripts
│   ├── run.bat
│   └── run.sh
├── static
│   ├── css
│   │   └── style.css
│   └── js
│       └── app.js
├── tests
│   └── test_app.py
└── twitch_checker
    ├── __init__.py
    ├── config.sample.json
    ├── database.py
    ├── ml_models.py
    └── twitch_checker.py
```

## Local Setup

1. Create a Twitch app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Copy `twitch_checker/config.sample.json` to `twitch_checker/config.json`, or set values in a local `.env`.
3. Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.
4. Run `scripts/run.sh` on macOS/Linux or `scripts/run.bat` on Windows.
5. Open [http://127.0.0.1:5050](http://127.0.0.1:5050).

## Supported Environment Variables

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_STREAMERS`
- `CHECK_INTERVAL`
- `DISCORD_WEBHOOK`
- `ENABLE_DISCORD_NOTIFICATIONS`
- `HISTORY_LIMIT`
- `SNAPSHOT_LIMIT`
- `EVENT_LIMIT`
- `ALERT_THRESHOLDS`
- `FRONTEND_TITLE`
- `FLASK_SECRET_KEY`

## API Routes

- `GET /`
- `GET /api/health`
- `GET /api/config`
- `GET /api/dashboard`
- `GET /api/stream/<login>`
- `GET /api/history/<login>`
- `GET /api/ml/predict/<login>`
- `GET /api/search?q=<query>`
- `POST /api/watchlist`
- `DELETE /api/watchlist/<login>`
- `GET /api/analytics/overview`
- `GET /api/analytics/leaderboards`
- `GET /api/analytics/compare?logins=kaicenat,pokimane`
- `GET /api/analytics/stream/<login>`

## Watchlist UX

- Use the search box in the hero to find Twitch channels
- Add creators directly to the tracked watchlist
- Remove the focused creator from the profile panel or remove anyone from the tracked grid
- Watch the focused creator directly in the in-app Twitch player

## Model Notes

- Forecasting uses a degree-2 polynomial regression baseline
- Output now includes:
  - predicted peak
  - confidence label
  - standard-error band
  - model MAE
  - naive-baseline MAE
- This is still a lightweight product demo model, not a production-grade time-series system

## Running Tests

```bash
python3 -m unittest discover -s tests -v
```

## Next Strong Upgrades

- Replace the polynomial regressor with a stronger time-series baseline and explicit backtesting splits
- Ingest real Twitch chat or social signals instead of placeholder sentiment snippets
- Add richer compare views for overlap, lag, and correlation
- Persist richer watchlist metadata such as favorites or saved comparison pairs
- Add auth if you ever want multi-user shared watchlists

## Security Notes

- Never commit real Twitch credentials
- Keep secrets in ignored local files or deployment environment variables
- Rotate exposed Twitch secrets immediately in the Twitch developer console
