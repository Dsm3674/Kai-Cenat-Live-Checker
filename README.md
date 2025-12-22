# 🎮 Kai Cenat Live Checker

A real-time Twitch stream status checker with OAuth login support. Check if Kai Cenat (or any Twitch streamer) is currently live!

![Python](https://img.shields.io/badge/python-3.7+-blue.svg)
![Flask](https://img.shields.io/badge/flask-3.0+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- 🔴 **Real-time Live Status** - Check if any Twitch streamer is currently live
- 📊 **Stream Details** - View viewer count, uptime, game, and stream title
- 🔐 **OAuth Login** - Login with Twitch to quickly check your own channel
- 🎨 **Modern UI** - Beautiful gradient design with smooth animations
- ⚡ **Auto-refresh** - Updates every 60 seconds automatically
- 🌐 **CORS Enabled** - Works with any frontend setup

## 📁 Project Structure

```
Kai Cenat Live/
├── twitch_checker/
│   ├── __init__.py
│   ├── twitch_checker.py    # Flask backend with OAuth
│   └── config.json           # Your Twitch API credentials (create this)
├── kaiCenat.css              # Simple version styling
├── kaiCent.html              # Simple live checker
└── index.html                # Advanced control panel

requirements.txt              # Python dependencies
.gitignore                    # Protects your secrets
README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.7 or higher
- pip (Python package manager)
- A Twitch Developer account

### 1. Clone the Repository

```bash
git clone https://github.com/Dsm3674/kai-cenat-live-checker.git
cd kai-cenat-live-checker
```

### 2. Install Dependencies

**For Mac/Linux:**
```bash
pip3 install -r requirements.txt
```

**For Windows:**
```bash
pip install -r requirements.txt
```

**Manual Installation:**
```bash
pip3 install flask flask-cors requests
```

### 3. Get Twitch API Credentials

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click **"Register Your Application"**
3. Fill in the details:
   - **Name:** Kai Cenat Live Checker (or any name)
   - **OAuth Redirect URLs:** `http://localhost:5050/auth/callback`
   - **Category:** Website Integration
4. Click **"Create"**
5. Click **"Manage"** on your new app
6. Copy your **Client ID**
7. Click **"New Secret"** and copy your **Client Secret**

### 4. Create Configuration File

Create a file named `config.json` inside the `twitch_checker` folder:

```json
{
  "client_id": "paste_your_client_id_here",
  "client_secret": "paste_your_client_secret_here",
  "redirect_uri": "http://localhost:5050/auth/callback"
}
```

⚠️ **Important:** Never commit `config.json` to GitHub! It's already in `.gitignore`.

### 5. Run the Application

**Terminal 1 - Start the Backend:**

```bash
cd "Kai Cenat Live/twitch_checker"
python3 twitch_checker.py
```

You should see:
```
🚀 Backend API running at http://localhost:5050
📝 Make sure to update config.json with your Twitch credentials
```

**Terminal 2 - Start the Frontend:**

```bash
cd "Kai Cenat Live"
python3 -m http.server 8000
```

You should see:
```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

### 6. Open in Browser

- **Simple Version:** [http://localhost:8000/kaiCent.html](http://localhost:8000/kaiCent.html)
- **Control Panel:** [http://localhost:8000/index.html](http://localhost:8000/index.html)

## 📄 Complete File Code

### `requirements.txt`
```
flask
flask-cors
requests
```

### `.gitignore`
```
# Don't upload secrets!
config.json

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python

# Virtual environment
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo

# macOS
.DS_Store

# Windows
Thumbs.db
```

### `config.json` (Template - Create this file)
```json
{
  "client_id": "YOUR_CLIENT_ID_HERE",
  "client_secret": "YOUR_CLIENT_SECRET_HERE",
  "redirect_uri": "http://localhost:5050/auth/callback"
}
```

## 🎯 Usage

### Simple Version (kaiCent.html)
- Shows a red banner when Kai Cenat is live
- Auto-refreshes every minute
- No login required

### Control Panel (index.html)
- Check **any** Twitch channel by username
- Login with Twitch to quickly check your own channel
- View detailed stream information:
  - Channel name
  - Viewer count
  - Stream uptime
  - Current game/category
  - Stream title
- Manual refresh button
- Auto-refreshes every minute

## 🔧 API Endpoints

The backend provides these REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/live/<username>` | GET | Check if a user is live |
| `/api/me` | GET | Get logged-in user info |
| `/auth/twitch` | GET | Start OAuth login flow |
| `/auth/callback` | GET | Handle OAuth callback |
| `/auth/logout` | GET | Logout current user |

### Example API Response

**Live Stream:**
```json
{
  "live": true,
  "user": "kaicenat",
  "title": "24 HOUR STREAM",
  "game": "Just Chatting",
  "viewers": 85234,
  "uptime": "3h 42m"
}
```

**Offline:**
```json
{
  "live": false
}
```

## 🛠️ Troubleshooting

### "ModuleNotFoundError: No module named 'flask'"
**Solution:** Install the required packages
```bash
pip3 install flask flask-cors requests
```

### "Backend API error" in browser console
**Solution:** Make sure the backend is running on port 5050
```bash
cd "Kai Cenat Live/twitch_checker"
python3 twitch_checker.py
```

### "401 Unauthorized" from Twitch API
**Solution:** Check your `config.json` credentials
- Make sure Client ID and Client Secret are correct
- Regenerate your Client Secret if needed

### CORS errors
**Solution:** Make sure you're accessing the frontend through `http://localhost:8000`, not `file://`

### Login doesn't work
**Solution:** Verify your OAuth redirect URL
- In Twitch Developer Console: `http://localhost:5050/auth/callback`
- In config.json: `"redirect_uri": "http://localhost:5050/auth/callback"`
- Both must match exactly

### Port already in use
**Solution:** Kill the process using the port
```bash
# Mac/Linux
lsof -ti:5050 | xargs kill
lsof -ti:8000 | xargs kill

# Windows
netstat -ano | findstr :5050
taskkill /PID <PID> /F
```

## 🔒 Security Notes

- ⚠️ **Never commit `config.json`** - It contains your API secrets
- ⚠️ **Never share your Client Secret** - Treat it like a password
- ⚠️ **Use HTTPS in production** - HTTP is only for local development
- ⚠️ **Change `app.secret_key`** - Use a random string in production
- ⚠️ **Don't expose ports to internet** - Use a proper hosting service for public deployment

## 🌐 Deployment

To make this accessible on the internet, deploy to a hosting service:

### Recommended Free Services:
- **[Render.com](https://render.com)** - Easy, automatic deployment
- **[Railway.app](https://railway.app)** - Fast setup with GitHub integration
- **[Fly.io](https://fly.io)** - Lightweight deployment
- **[PythonAnywhere](https://www.pythonanywhere.com)** - Python-focused hosting

**Note:** Update the `redirect_uri` in both your Twitch app settings and `config.json` to match your deployed URL.

## 📝 Files to Create

Here are the 3 files you need to create and upload to GitHub:

### 1. Create `requirements.txt` in root folder:
```
flask
flask-cors
requests
```

### 2. Create `.gitignore` in root folder:
```
config.json
__pycache__/
*.pyc
venv/
env/
.DS_Store
```

### 3. Create `config.json` in `twitch_checker/` folder (don't upload to GitHub):
```json
{
  "client_id": "your_actual_twitch_client_id",
  "client_secret": "your_actual_twitch_client_secret",
  "redirect_uri": "http://localhost:5050/auth/callback"
}
```

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**@Dsm3674**
- GitHub: [@Dsm3674](https://github.com/Dsm3674)

## 🙏 Acknowledgments

- Built with [Flask](https://flask.palletsprojects.com/)
- Uses [Twitch Helix API](https://dev.twitch.tv/docs/api/)
- Font: [Outfit](https://fonts.google.com/specimen/Outfit) by Google Fonts

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Note:** This is a personal project and is not affiliated with Twitch Interactive, Inc. or Kai Cenat.
