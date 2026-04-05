#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if [ ! -f twitch_checker/config.json ]; then
  cp twitch_checker/config.sample.json twitch_checker/config.json
  echo "Created twitch_checker/config.json."
  echo "Add your Twitch client credentials or use a local .env file."
fi

echo "Starting Twitch dashboard on http://127.0.0.1:5050"
python -m twitch_checker.twitch_checker
