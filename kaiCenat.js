const state = {
  dashboard: null,
  previousLiveMap: new Map(),
  favorites: new Set(JSON.parse(localStorage.getItem("favorite-streamers") || "[]")),
  notificationsEnabled: localStorage.getItem("browser-notifications-enabled") === "true",
  searchTerm: "",
  favoritesOnly: false,
  intervalId: null,
};

const elements = {
  alertBox: document.getElementById("alertBox"),
  appTitle: document.getElementById("appTitle"),
  emptyState: document.getElementById("emptyState"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  lastUpdated: document.getElementById("lastUpdated"),
  liveCount: document.getElementById("liveCount"),
  notifyButton: document.getElementById("notifyButton"),
  offlineCount: document.getElementById("offlineCount"),
  pollingText: document.getElementById("pollingText"),
  refreshButton: document.getElementById("refreshButton"),
  searchInput: document.getElementById("searchInput"),
  streamGrid: document.getElementById("streamGrid"),
  trackedCount: document.getElementById("trackedCount"),
  template: document.getElementById("cardTemplate"),
};

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSession(session) {
  const started = formatDateTime(session.started_at);
  const ended = session.ended_at ? formatDateTime(session.ended_at) : "Still live";
  const title = session.title || "Untitled stream";
  return `${started} -> ${ended} | ${title}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function browserNotificationsSupported() {
  return "Notification" in window;
}

function saveFavorites() {
  localStorage.setItem("favorite-streamers", JSON.stringify([...state.favorites]));
}

function showAlert(message, kind = "error") {
  elements.alertBox.textContent = message;
  elements.alertBox.className = `alert ${kind}`;
}

function hideAlert() {
  elements.alertBox.className = "alert hidden";
  elements.alertBox.textContent = "";
}

async function ensureNotificationPermission() {
  if (!browserNotificationsSupported()) {
    showAlert("This browser does not support desktop notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  const result = await Notification.requestPermission();
  return result === "granted";
}

function notifyForNewLives(streamers) {
  if (!state.notificationsEnabled || !browserNotificationsSupported() || Notification.permission !== "granted") {
    return;
  }

  for (const streamer of streamers) {
    const previousLive = state.previousLiveMap.get(streamer.login);
    if (previousLive === false && streamer.is_live) {
      new Notification(`${streamer.display_name} is live`, {
        body: streamer.title || "Open Twitch to watch now.",
        icon: streamer.profile_image_url || undefined,
      });
    }
  }
}

function buildCard(streamer) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".stream-card");
  const media = fragment.querySelector(".card-media");
  const liveBadge = fragment.querySelector(".live-badge");
  const streamImage = fragment.querySelector(".stream-image");
  const avatar = fragment.querySelector(".avatar");
  const displayName = fragment.querySelector(".display-name");
  const login = fragment.querySelector(".login");
  const favoriteButton = fragment.querySelector(".favorite-button");
  const statusText = fragment.querySelector(".status-text");
  const streamTitle = fragment.querySelector(".stream-title");
  const description = fragment.querySelector(".description");
  const gameName = fragment.querySelector(".game-name");
  const viewerCount = fragment.querySelector(".viewer-count");
  const uptime = fragment.querySelector(".uptime");
  const broadcasterType = fragment.querySelector(".broadcaster-type");
  const watchLink = fragment.querySelector(".watch-link");
  const historyToggle = fragment.querySelector(".history-toggle");
  const historyPanel = fragment.querySelector(".history-panel");
  const historyList = fragment.querySelector(".history-list");

  const liveImage = streamer.thumbnail_url || streamer.offline_image_url || streamer.profile_image_url;
  streamImage.src = liveImage || "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  streamImage.alt = `${streamer.display_name} preview`;
  avatar.src = streamer.profile_image_url || liveImage || "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  avatar.alt = `${streamer.display_name} avatar`;
  displayName.textContent = streamer.display_name;
  login.textContent = `@${streamer.login}`;
  statusText.textContent = streamer.is_live
    ? `Live now. Started ${formatDateTime(streamer.started_at)}`
    : `Offline. Last checked ${formatDateTime(streamer.last_seen_at)}`;
  streamTitle.textContent = streamer.title || "No live stream right now";
  description.textContent = streamer.description || "No channel description available.";
  gameName.textContent = streamer.game_name || "Offline";
  viewerCount.textContent = streamer.is_live ? formatNumber(streamer.viewer_count) : "0";
  uptime.textContent = streamer.is_live ? streamer.uptime : "Offline";
  broadcasterType.textContent = streamer.broadcaster_type || "Standard";
  watchLink.href = streamer.url;
  liveBadge.textContent = streamer.is_live ? "LIVE" : "OFFLINE";
  media.classList.toggle("offline", !streamer.is_live);

  const isFavorite = state.favorites.has(streamer.login);
  favoriteButton.textContent = isFavorite ? "Saved" : "Save";
  favoriteButton.classList.toggle("active", isFavorite);
  favoriteButton.addEventListener("click", () => {
    if (state.favorites.has(streamer.login)) {
      state.favorites.delete(streamer.login);
    } else {
      state.favorites.add(streamer.login);
    }
    saveFavorites();
    renderDashboard();
  });

  const sessions = streamer.recent_sessions || [];
  historyList.replaceChildren();
  if (!sessions.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No recent completed sessions yet.";
    historyList.appendChild(emptyItem);
  } else {
    for (const session of sessions) {
      const item = document.createElement("li");
      item.textContent = formatSession(session);
      historyList.appendChild(item);
    }
  }

  historyToggle.addEventListener("click", () => {
    historyPanel.classList.toggle("hidden");
  });

  card.dataset.login = streamer.login;
  card.dataset.live = String(streamer.is_live);
  return fragment;
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) {
    return;
  }

  elements.appTitle.textContent = dashboard.title;
  elements.trackedCount.textContent = dashboard.summary.tracked;
  elements.liveCount.textContent = dashboard.summary.live;
  elements.offlineCount.textContent = dashboard.summary.offline;
  elements.lastUpdated.textContent = formatDateTime(dashboard.generated_at);
  elements.pollingText.textContent = `Auto refresh every ${dashboard.check_interval} seconds`;

  const filtered = dashboard.streamers.filter((streamer) => {
    const haystack = [
      streamer.display_name,
      streamer.login,
      streamer.title,
      streamer.game_name,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = haystack.includes(state.searchTerm);
    const matchesFavorites = !state.favoritesOnly || state.favorites.has(streamer.login);
    return matchesSearch && matchesFavorites;
  });

  elements.streamGrid.innerHTML = "";
  for (const streamer of filtered) {
    elements.streamGrid.appendChild(buildCard(streamer));
  }

  elements.emptyState.classList.toggle("hidden", filtered.length > 0);
}

async function fetchDashboard() {
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.error || "Request failed");
    }

    hideAlert();
    notifyForNewLives(data.streamers);
    for (const streamer of data.streamers) {
      state.previousLiveMap.set(streamer.login, streamer.is_live);
    }
    state.dashboard = data;
    renderDashboard();
  } catch (error) {
    showAlert(`Unable to load real Twitch data: ${error.message}`);
  }
}

function setupPolling(intervalSeconds) {
  if (state.intervalId) {
    window.clearInterval(state.intervalId);
  }

  state.intervalId = window.setInterval(fetchDashboard, intervalSeconds * 1000);
}

async function bootstrap() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderDashboard();
  });

  elements.favoritesOnly.addEventListener("change", (event) => {
    state.favoritesOnly = event.target.checked;
    renderDashboard();
  });

  elements.refreshButton.addEventListener("click", () => {
    fetchDashboard();
  });

  elements.notifyButton.addEventListener("click", async () => {
    const granted = await ensureNotificationPermission();
    state.notificationsEnabled = granted;
    localStorage.setItem("browser-notifications-enabled", String(granted));
    elements.notifyButton.textContent = granted ? "Browser alerts enabled" : "Enable browser alerts";
  });

  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    const config = await configResponse.json();
    setupPolling(config.check_interval || 60);
    await fetchDashboard();
  } catch (error) {
    showAlert(`Unable to load app settings: ${error.message}`);
  }

  if (state.notificationsEnabled && browserNotificationsSupported() && Notification.permission === "granted") {
    elements.notifyButton.textContent = "Browser alerts enabled";
  }
}

bootstrap();
