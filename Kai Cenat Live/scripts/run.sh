
set -euo pipefail
cd "$(dirname "$0")/.."



if [ ! -d .venv ]; then
python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt


cd twitch_checker

if [ ! -f config.json ]; then
cp config.sample.json config.json
echo "Created twitch_checker/config.json — fill in your Client ID/Secret."
fi
python twitch_checker.py