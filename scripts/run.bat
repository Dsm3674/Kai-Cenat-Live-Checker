@echo off
setlocal
pushd %~dp0\..

if not exist .venv (
  py -3 -m venv .venv
)

call .venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if not exist twitch_checker\config.json (
  copy twitch_checker\config.sample.json twitch_checker\config.json >nul
  echo Created twitch_checker\config.json.
  echo Add your Twitch client credentials or use a local .env file.
)

echo Starting Twitch dashboard on http://127.0.0.1:5050
python -m twitch_checker.twitch_checker

popd
