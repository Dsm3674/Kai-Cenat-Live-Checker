


# Kai Cenat Live Checker

A Python-based tool that monitors Twitch streamers (like Kai Cenat) and instantly notifies you when they go live.  
Get alerts via desktop notifications or Discord webhooks — fully customizable and easy to run.

(So far its currently Kai Cenat, I will add more like IShowSpeed later on).

---

### Features

- Monitor one or multiple Twitch streamers  
- Desktop notifications using [plyer](https://plyer.readthedocs.io/en/latest/)  
- Optional Discord webhook alerts  
- Adjustable check interval (default: 60 seconds)  
- Logs stream history (live/offline events)  
- Simple configuration via `config.json`  
- Cross-platform — works on Windows, macOS, and Linux

---

## Requirements

- Python 3.8+
- A Twitch Developer App (for `client_id` and `client_secret`)  
  Create one at [Twitch Developer Console](https://dev.twitch.tv/console)

---

## Setup

### Clone the Repository

```bash
git clone https://github.com/Dsm3674/Kai-Cenat-Live-Checker.git
cd Kai-Cenat-Live-Checker/twitch_checker
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note:** If you don’t want desktop notifications, you can skip installing `plyer`. The script will still run without it.

### Configure Twitch Credentials

When you first run the script, it creates a default `config.json`. Alternatively, copy the sample configuration:

```bash
cp config.sample.json config.json
```

Edit `config.json` with your Twitch API credentials:

```json
{
  "client_id": "YOUR_CLIENT_ID_HERE",
  "client_secret": "YOUR_CLIENT_SECRET_HERE",
  "streamers": ["kaicenat"],
  "check_interval": 60,
  "discord_webhook": "",
  "enable_desktop_notifications": true,
  "enable_discord_notifications": false,
  "log_level": "INFO"
}
```

---

## Run the Checker

From the `twitch_checker` folder, run:

```bash
python twitch_checker.py
```

To stop the script:  
`CTRL + C`

---

## Notifications

### Desktop Notifications

If `plyer` is installed and enabled in `config.json`, you’ll see system pop-ups like:

```
🔴 KaiCenat is LIVE!
Playing: Just Chatting
“Late Night Stream!”
```

### Discord Alerts

If Discord notifications are enabled in `config.json`, the bot posts messages to your server:

```
KaiCenat is now LIVE 🔴
Playing: Just Chatting
Viewers: 25,000
```

---

## Logs

Logs are automatically stored in:

- Main logs: `logs/twitch_checker.log`
- Stream history: `stream_logs/<streamer>_history.json`

---

## Project Structure

```
Kai-Cenat-Live-Checker/
├── kaiCent.html
├── kaiCenat.css
├── twitch_checker/
│   ├── twitch_checker.py
│   ├── config.sample.json
│   ├── requirements.txt
│   ├── logs/
│   └── stream_logs/
├── README.md
└── .gitignore
```

---

## Example Output

```
2025-10-04 13:02:11 - INFO - 🔴 KaiCenat is now LIVE!
2025-10-04 13:02:11 - INFO -    Title: The marathon continues
2025-10-04 13:02:11 - INFO -    Game: Just Chatting
2025-10-04 13:10:23 - INFO - ✓ KaiCenat - Live for 8m - 24213 viewers
2025-10-04 14:05:02 - INFO - ⚫ KaiCenat went offline
```

---

## Tips

- Set `"check_interval": 60` for a 1-minute refresh rate.  
- Monitor multiple streamers by adding usernames to the `"streamers"` list in `config.json`.  
- No Twitch login is required — only app credentials (Client ID & Secret).  
- The script handles network errors and rate limits automatically.

---

## Troubleshooting

- **“Install 'plyer' for desktop notifications”**  
  → Run `pip install plyer` or set `"enable_desktop_notifications": false` in `config.json`.

- **“Invalid Client ID / Unauthorized”**  
  → Verify your Twitch credentials in `config.json`.

- **“No notifications or logs created”**  
  → Ensure you’re running the script from the `twitch_checker` directory.

---

## Contributing

Pull requests are welcome! Ideas for contributions:

- Add support for other streaming platforms.  
- Create a GUI dashboard.  
- Enhance webhook or logging features.

To contribute:

1. Fork the repo.  
2. Make your changes.  
3. Submit a pull request.

---

## Credits

Developed by DSM3674 or Divyanshu Matam Somasekhar 
Inspired by the energy and creativity of Kai Cenat and the Twitch community

---

Let me know if you want me to help with anything else by email divyanshusomasekhar1@gmail.com
