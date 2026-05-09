const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const state = {
  dashboard: null,
  favorites: new Set(JSON.parse(localStorage.getItem("favorite-streamers") || "[]")),
  compare: new Set(JSON.parse(localStorage.getItem("compare-streamers") || "[]")),
  notificationsEnabled: localStorage.getItem("browser-notifications-enabled") === "true",
  seenAlertIds: new Set(),
  previousFavoriteLiveCount: 0,
  searchTerm: "",
  selectedGroup: "all",
  favoritesOnly: false,
  liveOnly: false,
  intervalId: null,
};

const elements = {
  alertBox: document.getElementById("alertBox"),
  alertsFeed: document.getElementById("alertsFeed"),
  appTitle: document.getElementById("appTitle"),
  categoryMix: document.getElementById("categoryMix"),
  compareChips: document.getElementById("compareChips"),
  compareCount: document.getElementById("compareCount"),
  compareTableWrap: document.getElementById("compareTableWrap"),
  dominantCategory: document.getElementById("dominantCategory"),
  dominantMeta: document.getElementById("dominantMeta"),
  emptyState: document.getElementById("emptyState"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  groupSelect: document.getElementById("groupSelect"),
  groupSummary: document.getElementById("groupSummary"),
  hourlyChart: document.getElementById("hourlyChart"),
  lastUpdated: document.getElementById("lastUpdated"),
  leaderboards: document.getElementById("leaderboards"),
  liveCount: document.getElementById("liveCount"),
  liveMeta: document.getElementById("liveMeta"),
  liveOnly: document.getElementById("liveOnly"),
  notifyButton: document.getElementById("notifyButton"),
  pollingText: document.getElementById("pollingText"),
  refreshButton: document.getElementById("refreshButton"),
  searchInput: document.getElementById("searchInput"),
  spotlightGrid: document.getElementById("spotlightGrid"),
  streamGrid: document.getElementById("streamGrid"),
  template: document.getElementById("cardTemplate"),
  trackedCount: document.getElementById("trackedCount"),
  trackedMeta: document.getElementById("trackedMeta"),
  viewerMeta: document.getElementById("viewerMeta"),
  viewerTotal: document.getElementById("viewerTotal"),
  weekdayChart: document.getElementById("weekdayChart"),
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

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatCompact(value) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatMinutes(value) {
  const minutes = Number(value) || 0;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatSession(session) {
  const started = formatDateTime(session.started_at);
  const ended = session.ended_at ? formatDateTime(session.ended_at) : "Still live";
  const peak = formatCompact(session.peak_viewers || 0);
  const average = formatCompact(session.avg_viewers || 0);
  const duration = formatMinutes(session.duration_minutes || 0);
  return `${started} -> ${ended} | ${session.game_name || "Unknown"} | peak ${peak} | avg ${average} | ${duration}`;
}

function browserNotificationsSupported() {
  return "Notification" in window;
}

function saveFavorites() {
  localStorage.setItem("favorite-streamers", JSON.stringify([...state.favorites]));
}

function saveCompare() {
  localStorage.setItem("compare-streamers", JSON.stringify([...state.compare]));
}

function showAlert(message, kind = "info") {
  elements.alertBox.textContent = message;
  elements.alertBox.className = `flash-message ${kind}`;
}

function hideAlert() {
  elements.alertBox.className = "flash-message hidden";
  elements.alertBox.textContent = "";
}

async function ensureNotificationPermission() {
  if (!browserNotificationsSupported()) {
    showAlert("This browser does not support smart alerts.", "error");
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  return (await Notification.requestPermission()) === "granted";
}

function buildSparkline(points) {
  if (!points.length) {
    return "";
  }
  const values = points.map((point) => point.viewers || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(max - min, 1);
  const coordinates = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 34 - (((value - min) / spread) * 28);
    return `${x},${y}`;
  });
  return `<polyline fill="none" stroke="currentColor" stroke-width="2" points="${coordinates.join(" ")}"></polyline>`;
}

function renderBarList(container, items, formatter = formatCompact) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = "Not enough data yet.";
    container.appendChild(empty);
    return;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-copy">
        <span>${item.name}</span>
        <strong>${formatter(item.value)}</strong>
      </div>
      <div class="bar-track"><span style="width:${(item.value / max) * 100}%"></span></div>
    `;
    container.appendChild(row);
  }
}

function renderSpotlights(overview) {
  elements.spotlightGrid.replaceChildren();
  const items = [
    {
      title: "Hottest Live Stream",
      value: overview.hottest_stream ? overview.hottest_stream.display_name : "Waiting",
      meta: overview.hottest_stream ? `${formatCompact(overview.hottest_stream.viewer_count)} viewers` : "No live streams right now",
    },
    {
      title: "Most Consistent",
      value: overview.most_consistent ? overview.most_consistent.display_name : "Waiting",
      meta: overview.most_consistent ? `${overview.most_consistent.score} score` : "Needs more history",
    },
    {
      title: "Biggest Peak",
      value: overview.biggest_peak ? overview.biggest_peak.display_name : "Waiting",
      meta: overview.biggest_peak ? `${formatCompact(overview.biggest_peak.peak_viewers)} peak viewers` : "Needs more history",
    },
  ];
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "spotlight-card";
    card.innerHTML = `<span>${item.title}</span><strong>${item.value}</strong><p>${item.meta}</p>`;
    elements.spotlightGrid.appendChild(card);
  }
}

function renderGroupSummary(groups) {
  elements.groupSummary.replaceChildren();
  for (const group of groups) {
    const card = document.createElement("article");
    card.className = "group-card";
    card.innerHTML = `
      <span>${group.name}</span>
      <strong>${group.live}/${group.tracked} live</strong>
      <p>${formatCompact(group.current_viewers)} viewers right now</p>
    `;
    elements.groupSummary.appendChild(card);
  }
}

function renderLeaderboards(leaderboards) {
  elements.leaderboards.replaceChildren();
  const sections = [
    ["Live Now", leaderboards.live_now, "viewers"],
    ["Best Peak", leaderboards.best_peak, "peak"],
    ["Most Active", leaderboards.most_active, "sessions"],
    ["Trend Score", leaderboards.trend, "score"],
  ];
  for (const [title, rows, suffix] of sections) {
    const section = document.createElement("section");
    section.className = "leaderboard-card";
    const list = rows
      .map(
        (row, index) => `
          <li>
            <span>${index + 1}. ${row.display_name}</span>
            <strong>${formatCompact(row.value)} ${suffix}</strong>
            <small>${row.meta}</small>
          </li>
        `
      )
      .join("");
    section.innerHTML = `<h3>${title}</h3><ol>${list}</ol>`;
    elements.leaderboards.appendChild(section);
  }
}

function renderAlertFeed(alerts) {
  elements.alertsFeed.replaceChildren();
  if (!alerts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = "No alert events yet. Once streams change state, milestone alerts will appear here.";
    elements.alertsFeed.appendChild(empty);
    return;
  }
  for (const alert of alerts) {
    const row = document.createElement("article");
    row.className = `alert-row severity-${alert.severity}`;
    row.innerHTML = `
      <div>
        <strong>${alert.display_name}</strong>
        <p>${alert.message}</p>
      </div>
      <time>${formatDateTime(alert.created_at)}</time>
    `;
    elements.alertsFeed.appendChild(row);
  }
}

function renderCompareSection(streamers, defaults) {
  if (!state.compare.size) {
    for (const login of defaults || []) {
      if (state.compare.size < 4) {
        state.compare.add(login);
      }
    }
    saveCompare();
  }

  const compared = streamers.filter((streamer) => state.compare.has(streamer.login)).slice(0, 4);
  elements.compareCount.textContent = `${compared.length} selected`;
  elements.compareChips.replaceChildren();

  for (const streamer of compared) {
    const chip = document.createElement("button");
    chip.className = "selection-chip";
    chip.type = "button";
    chip.textContent = streamer.display_name;
    chip.addEventListener("click", () => {
      state.compare.delete(streamer.login);
      saveCompare();
      renderDashboard();
    });
    elements.compareChips.appendChild(chip);
  }

  if (!compared.length) {
    elements.compareTableWrap.innerHTML = `<p class="empty-copy">Use the compare buttons on streamer cards to build a side-by-side table.</p>`;
    return;
  }

  const rows = compared
    .map((streamer) => {
      const analytics = streamer.analytics;
      return `
        <tr>
          <th>${streamer.display_name}</th>
          <td>${streamer.is_live ? "Live" : "Offline"}</td>
          <td>${formatCompact(streamer.viewer_count)}</td>
          <td>${analytics.session_count}</td>
          <td>${formatMinutes(analytics.avg_duration_minutes)}</td>
          <td>${formatCompact(analytics.best_peak_viewers)}</td>
          <td>${analytics.top_category}</td>
          <td>${analytics.trend_score}</td>
          <td>${analytics.consistency_score}</td>
        </tr>
      `;
    })
    .join("");

  elements.compareTableWrap.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Streamer</th>
          <th>Status</th>
          <th>Current</th>
          <th>Sessions</th>
          <th>Avg Duration</th>
          <th>Best Peak</th>
          <th>Top Category</th>
          <th>Trend</th>
          <th>Consistency</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function toggleFavorite(login) {
  if (state.favorites.has(login)) {
    state.favorites.delete(login);
  } else {
    state.favorites.add(login);
  }
  saveFavorites();
  renderDashboard();
}

function toggleCompare(login) {
  if (state.compare.has(login)) {
    state.compare.delete(login);
  } else {
    if (state.compare.size >= 4) {
      showAlert("You can compare up to four streamers at a time.", "error");
      return;
    }
    state.compare.add(login);
  }
  saveCompare();
  renderDashboard();
}

function buildCard(streamer) {
  const fragment = elements.template.content.cloneNode(true);
  const media = fragment.querySelector(".card-media");
  const liveBadge = fragment.querySelector(".live-badge");
  const streamImage = fragment.querySelector(".stream-image");
  const avatar = fragment.querySelector(".avatar");
  const displayName = fragment.querySelector(".display-name");
  const login = fragment.querySelector(".login");
  const groupsRow = fragment.querySelector(".groups-row");
  const favoriteButton = fragment.querySelector(".favorite-button");
  const compareButton = fragment.querySelector(".compare-button");
  const statusText = fragment.querySelector(".status-text");
  const streamTitle = fragment.querySelector(".stream-title");
  const description = fragment.querySelector(".description");
  const sparkline = fragment.querySelector(".sparkline");
  const gameName = fragment.querySelector(".game-name");
  const viewerCount = fragment.querySelector(".viewer-count");
  const uptime = fragment.querySelector(".uptime");
  const sessionCount = fragment.querySelector(".session-count");
  const peakCount = fragment.querySelector(".peak-count");
  const avgDuration = fragment.querySelector(".avg-duration");
  const trendScore = fragment.querySelector(".trend-score");
  const consistencyScore = fragment.querySelector(".consistency-score");
  const topCategory = fragment.querySelector(".top-category");
  const watchLink = fragment.querySelector(".watch-link");
  const historyToggle = fragment.querySelector(".history-toggle");
  const historyPanel = fragment.querySelector(".history-panel");
  const historyList = fragment.querySelector(".history-list");

  const analytics = streamer.analytics;
  const liveImage = streamer.thumbnail_url || streamer.offline_image_url || streamer.profile_image_url;
  streamImage.src = liveImage || "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  streamImage.alt = `${streamer.display_name} preview`;
  avatar.src = streamer.profile_image_url || liveImage || "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  avatar.alt = `${streamer.display_name} avatar`;
  displayName.textContent = streamer.display_name;
  login.textContent = `@${streamer.login}`;

  for (const group of streamer.groups) {
    const chip = document.createElement("span");
    chip.className = "mini-chip";
    chip.textContent = group;
    groupsRow.appendChild(chip);
  }

  statusText.textContent = streamer.is_live
    ? `Live now. Started ${formatDateTime(streamer.started_at)}`
    : `Offline. Last checked ${formatDateTime(streamer.last_seen_at)}`;
  streamTitle.textContent = streamer.title || "No live stream right now";
  description.textContent = streamer.description || "No channel description available.";
  sparkline.innerHTML = buildSparkline(streamer.recent_snapshots || []);
  gameName.textContent = streamer.game_name || "Offline";
  viewerCount.textContent = streamer.is_live ? formatCompact(streamer.viewer_count) : "0";
  uptime.textContent = streamer.is_live ? streamer.uptime : "Offline";
  sessionCount.textContent = analytics.session_count;
  peakCount.textContent = formatCompact(analytics.best_peak_viewers);
  avgDuration.textContent = formatMinutes(analytics.avg_duration_minutes);
  trendScore.textContent = analytics.trend_score;
  consistencyScore.textContent = analytics.consistency_score;
  topCategory.textContent = analytics.top_category;
  watchLink.href = streamer.url;
  liveBadge.textContent = streamer.is_live ? "LIVE" : "OFFLINE";
  media.classList.toggle("offline", !streamer.is_live);

  favoriteButton.textContent = state.favorites.has(streamer.login) ? "Saved" : "Save";
  favoriteButton.classList.toggle("active", state.favorites.has(streamer.login));
  favoriteButton.addEventListener("click", () => toggleFavorite(streamer.login));

  compareButton.textContent = state.compare.has(streamer.login) ? "Added" : "Compare";
  compareButton.classList.toggle("active", state.compare.has(streamer.login));
  compareButton.addEventListener("click", () => toggleCompare(streamer.login));

  historyList.replaceChildren();
  const sessions = streamer.recent_sessions || [];
  if (!sessions.length) {
    const item = document.createElement("li");
    item.textContent = "No completed sessions yet.";
    historyList.appendChild(item);
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

  return fragment;
}

function renderGroupSelect(streamerGroups) {
  const current = state.selectedGroup;
  elements.groupSelect.innerHTML = `<option value="all">All groups</option>`;
  for (const groupName of Object.keys(streamerGroups)) {
    const option = document.createElement("option");
    option.value = groupName;
    option.textContent = groupName;
    elements.groupSelect.appendChild(option);
  }
  elements.groupSelect.value = current in streamerGroups || current === "all" ? current : "all";
}

function applyFilters(streamers) {
  return streamers.filter((streamer) => {
    const haystack = [
      streamer.display_name,
      streamer.login,
      streamer.title,
      streamer.game_name,
      streamer.analytics.top_category,
      ...streamer.groups,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = haystack.includes(state.searchTerm);
    const matchesFavorites = !state.favoritesOnly || state.favorites.has(streamer.login);
    const matchesLive = !state.liveOnly || streamer.is_live;
    const matchesGroup = state.selectedGroup === "all" || streamer.groups.includes(state.selectedGroup);
    return matchesSearch && matchesFavorites && matchesLive && matchesGroup;
  });
}

function notifySmartAlerts(alerts, streamers) {
  if (!state.notificationsEnabled || !browserNotificationsSupported() || Notification.permission !== "granted") {
    state.previousFavoriteLiveCount = streamers.filter((streamer) => streamer.is_live && state.favorites.has(streamer.login)).length;
    return;
  }

  for (const alert of alerts.slice().reverse()) {
    if (state.seenAlertIds.has(alert.id)) {
      continue;
    }
    state.seenAlertIds.add(alert.id);
    new Notification(`${alert.display_name}: ${alert.type.replaceAll("_", " ")}`, {
      body: alert.message,
    });
  }

  const favoriteLiveCount = streamers.filter((streamer) => streamer.is_live && state.favorites.has(streamer.login)).length;
  if (favoriteLiveCount >= 2 && state.previousFavoriteLiveCount < 2) {
    new Notification("Favorites cluster alert", {
      body: `${favoriteLiveCount} of your favorite streamers are live right now.`,
    });
  }
  state.previousFavoriteLiveCount = favoriteLiveCount;
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) {
    return;
  }

  renderGroupSelect(dashboard.group_summary.reduce((acc, group) => {
    acc[group.name] = true;
    return acc;
  }, {}));

  const filteredStreamers = applyFilters(dashboard.streamers);
  const overview = dashboard.overview;

  elements.appTitle.textContent = dashboard.title;
  elements.trackedCount.textContent = dashboard.summary.tracked;
  elements.trackedMeta.textContent = `${dashboard.summary.live} live, ${dashboard.summary.offline} offline`;
  elements.liveCount.textContent = dashboard.summary.live;
  elements.liveMeta.textContent = `${formatCompact(overview.avg_live_viewers)} avg live viewers`;
  elements.viewerTotal.textContent = formatCompact(dashboard.summary.current_viewers);
  elements.viewerMeta.textContent = overview.hottest_stream
    ? `${overview.hottest_stream.display_name} leads right now`
    : "waiting for live streams";
  elements.dominantCategory.textContent = overview.dominant_category;
  elements.dominantMeta.textContent = overview.biggest_peak
    ? `${overview.biggest_peak.display_name} owns the biggest recent peak`
    : "peak analytics need more sessions";
  elements.lastUpdated.textContent = formatDateTime(dashboard.generated_at);
  elements.pollingText.textContent = `Auto refresh every ${dashboard.check_interval} seconds`;

  renderSpotlights(overview);
  renderGroupSummary(dashboard.group_summary);
  renderLeaderboards(dashboard.leaderboards);
  renderAlertFeed(dashboard.alerts);
  renderCompareSection(dashboard.streamers, dashboard.compare_defaults);

  renderBarList(elements.categoryMix, dashboard.category_mix);
  renderBarList(
    elements.hourlyChart,
    overview.hourly_activity.map((value, hour) => ({ name: `${String(hour).padStart(2, "0")}:00`, value })),
    formatNumber,
  );
  renderBarList(
    elements.weekdayChart,
    overview.weekday_activity.map((value, index) => ({ name: DAY_LABELS[index], value })),
    formatNumber,
  );

  elements.streamGrid.innerHTML = "";
  for (const streamer of filteredStreamers) {
    elements.streamGrid.appendChild(buildCard(streamer));
  }
  elements.emptyState.classList.toggle("hidden", filteredStreamers.length > 0);
}

async function fetchDashboard() {
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Request failed");
    }
    hideAlert();
    state.dashboard = data;
    notifySmartAlerts(data.alerts || [], data.streamers || []);
    renderDashboard();
  } catch (error) {
    showAlert(`Unable to load real Twitch analytics: ${error.message}`, "error");
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

  elements.groupSelect.addEventListener("change", (event) => {
    state.selectedGroup = event.target.value;
    renderDashboard();
  });

  elements.favoritesOnly.addEventListener("change", (event) => {
    state.favoritesOnly = event.target.checked;
    renderDashboard();
  });

  elements.liveOnly.addEventListener("change", (event) => {
    state.liveOnly = event.target.checked;
    renderDashboard();
  });

  elements.refreshButton.addEventListener("click", () => {
    fetchDashboard();
  });

  elements.notifyButton.addEventListener("click", async () => {
    const granted = await ensureNotificationPermission();
    state.notificationsEnabled = granted;
    localStorage.setItem("browser-notifications-enabled", String(granted));
    elements.notifyButton.textContent = granted ? "Smart alerts enabled" : "Enable smart alerts";
  });

  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    const config = await configResponse.json();
    setupPolling(config.check_interval || 60);
    await fetchDashboard();
  } catch (error) {
    showAlert(`Unable to load app settings: ${error.message}`, "error");
  }

  if (state.notificationsEnabled && browserNotificationsSupported() && Notification.permission === "granted") {
    elements.notifyButton.textContent = "Smart alerts enabled";
  }
}

bootstrap();
