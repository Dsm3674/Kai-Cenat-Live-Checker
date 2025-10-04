
@echo off
setlocal EnableDelayedExpansion
pushd %~dp0\..


if not exist .venv (
py -3 -m venv .venv
)
call .venv\Scripts\activate
pip install -r requirements.txt


cd twitch_checker
if not exist config.json (
copy config.sample.json config.json >nul
echo Created twitch_checker\config.json — fill in your Client ID/Secret.
)
py -3 twitch_checker.py
popd