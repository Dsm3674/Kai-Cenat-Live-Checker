const state = {
    chart: null,
    config: null,
    dashboard: null,
    health: null,
    history: null,
    ml: null,
    selectedLogin: "",
    intervalId: null,
    searchTimer: null,
    searchResults: [],
    searchQuery: "",
};

const elements = {
    alertsFeed: document.getElementById("alertsFeed"),
    appTitle: document.getElementById("appTitle"),
    categoryMix: document.getElementById("categoryMix"),
    chartState: document.getElementById("chartState"),
    forecastSamples: document.getElementById("forecastSamples"),
    groupSummary: document.getElementById("groupSummary"),
    heroLastUpdated: document.getElementById("heroLastUpdated"),
    heroLiveCount: document.getElementById("heroLiveCount"),
    heroTrackedCount: document.getElementById("heroTrackedCount"),
    heroUpdateMeta: document.getElementById("heroUpdateMeta"),
    heroViewerTotal: document.getElementById("heroViewerTotal"),
    kpiAnomaly: document.getElementById("kpiAnomaly"),
    kpiAnomalyMeta: document.getElementById("kpiAnomalyMeta"),
    kpiConfidenceBadge: document.getElementById("kpiConfidenceBadge"),
    kpiConsistency: document.getElementById("kpiConsistency"),
    kpiCurrent: document.getElementById("kpiCurrent"),
    kpiError: document.getElementById("kpiError"),
    kpiErrorMeta: document.getElementById("kpiErrorMeta"),
    kpiPredict: document.getElementById("kpiPredict"),
    kpiSession: document.getElementById("kpiSession"),
    kpiTrendBadge: document.getElementById("kpiTrendBadge"),
    leaderboardList: document.getElementById("leaderboardList"),
    mainChart: document.getElementById("mainChart"),
    missionCategory: document.getElementById("missionCategory"),
    missionCategoryMeta: document.getElementById("missionCategoryMeta"),
    missionHeat: document.getElementById("missionHeat"),
    missionHeatMeta: document.getElementById("missionHeatMeta"),
    missionMode: document.getElementById("missionMode"),
    missionModeMeta: document.getElementById("missionModeMeta"),
    missionRefresh: document.getElementById("missionRefresh"),
    missionRefreshMeta: document.getElementById("missionRefreshMeta"),
    playerFrame: document.getElementById("streamPlayer"),
    playerMeta: document.getElementById("playerMeta"),
    playerState: document.getElementById("playerState"),
    refreshButton: document.getElementById("refreshButton"),
    removeStreamerButton: document.getElementById("removeStreamerButton"),
    searchInput: document.getElementById("streamerSearch"),
    searchResults: document.getElementById("searchResults"),
    selectedCategory: document.getElementById("selectedCategory"),
    selectedDescription: document.getElementById("selectedDescription"),
    selectedGroups: document.getElementById("selectedGroups"),
    selectedInsight: document.getElementById("selectedInsight"),
    selectedLogin: document.getElementById("selectedLogin"),
    selectedName: document.getElementById("selectedName"),
    selectedPeak: document.getElementById("selectedPeak"),
    selectedSessions: document.getElementById("selectedSessions"),
    selectedStatusPill: document.getElementById("selectedStatusPill"),
    selectedTitle: document.getElementById("selectedTitle"),
    selectedUptime: document.getElementById("selectedUptime"),
    sessionList: document.getElementById("sessionList"),
    streamerSelect: document.getElementById("streamerSelect"),
    systemBanner: document.getElementById("systemBanner"),
    trackedGrid: document.getElementById("trackedGrid"),
    watchLink: document.getElementById("watchLink"),
};

const chartAvailable = typeof window.Chart !== "undefined";

if (chartAvailable) {
    Chart.defaults.color = "#c5bdab";
    Chart.defaults.font.family = "IBM Plex Mono";
    Chart.defaults.borderColor = "rgba(244, 241, 232, 0.16)";
}

function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) {
        element.className = options.className;
    }
    if (options.text != null) {
        element.textContent = options.text;
    }
    if (options.attrs) {
        for (const [key, value] of Object.entries(options.attrs)) {
            if (value != null) {
                element.setAttribute(key, value);
            }
        }
    }
    return element;
}

function clearElement(element) {
    if (!element) {
        return;
    }
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function appendEmptyState(container, message) {
    clearElement(container);
    container.appendChild(createElement("p", { className: "empty-copy", text: message }));
}

function formatDateTime(value) {
    if (!value) {
        return "Waiting";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Waiting";
    }
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatCompact(value) {
    return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(Number(value) || 0);
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0);
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

function formatCacheAge(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "fresh";
    }
    if (seconds < 60) {
        return `${seconds}s old`;
    }
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m old`;
}

function titleCase(value) {
    if (!value) {
        return "Unknown";
    }
    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function showBanner(message, kind = "warning") {
    elements.systemBanner.textContent = message;
    elements.systemBanner.className = `system-banner ${kind}`;
}

function hideBanner() {
    elements.systemBanner.className = "system-banner hidden";
    elements.systemBanner.textContent = "";
}

function getSelectedStreamer() {
    return state.dashboard?.streamers?.find((streamer) => streamer.login === state.selectedLogin) || null;
}

function getTwitchParentHost() {
    const host = window.location.hostname || "localhost";
    return host === "0.0.0.0" ? "localhost" : host;
}

function getTwitchEmbedUrl(login) {
    const parent = encodeURIComponent(getTwitchParentHost());
    return `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${parent}&muted=true&autoplay=false`;
}

function buildPlaceholderStreamers(config) {
    const groups = config.streamer_groups || {};
    return (config.streamers || []).map((login) => ({
        login,
        display_name: login,
        title: "Live telemetry activates after credentials are connected.",
        description: "This placeholder keeps the interface presentation-ready even before real Twitch credentials are added.",
        is_live: false,
        game_name: "Awaiting data",
        viewer_count: 0,
        uptime: "Offline",
        url: `https://www.twitch.tv/${login}`,
        groups: Object.entries(groups)
            .filter(([, members]) => members.includes(login))
            .map(([name]) => name),
        analytics: {
            session_count: 0,
            avg_duration_minutes: 0,
            best_peak_viewers: 0,
            consistency_score: 0,
            trend_score: 0,
            top_category: "Awaiting data",
        },
        recent_sessions: [],
        recent_snapshots: [],
    }));
}

function buildFallbackDashboard() {
    const config = state.config || {};
    const streamers = buildPlaceholderStreamers(config);
    return {
        title: config.title || "Audience Signal Lab",
        generated_at: new Date().toISOString(),
        check_interval: config.check_interval || 60,
        summary: {
            tracked: streamers.length,
            live: 0,
            offline: streamers.length,
            current_viewers: 0,
        },
        overview: {
            dominant_category: "Awaiting data",
        },
        group_summary: Object.entries(config.streamer_groups || {}).map(([name, members]) => ({
            name,
            tracked: members.length,
            live: 0,
            current_viewers: 0,
        })),
        leaderboards: {
            live_now: [],
            best_peak: [],
            most_active: [],
            trend: [],
        },
        category_mix: [],
        alerts: [],
        streamers,
    };
}

function getTrendClass(trend) {
    if (trend === "growing" || trend === "high") {
        return "growing";
    }
    if (trend === "declining" || trend === "low") {
        return "declining";
    }
    if (trend === "stable" || trend === "medium") {
        return "stable";
    }
    return "neutral";
}

function setTrendBadge(trend) {
    const safeTrend = trend || "neutral";
    elements.kpiTrendBadge.textContent = titleCase(safeTrend);
    elements.kpiTrendBadge.className = `pill ${getTrendClass(safeTrend)}`;
}

function renderHero() {
    const dashboard = state.dashboard || buildFallbackDashboard();
    elements.appTitle.textContent = dashboard.title;
    elements.heroTrackedCount.textContent = formatNumber(dashboard.summary.tracked);
    elements.heroLiveCount.textContent = formatNumber(dashboard.summary.live);
    elements.heroViewerTotal.textContent = formatCompact(dashboard.summary.current_viewers);
    elements.heroLastUpdated.textContent = formatDateTime(dashboard.generated_at);
    elements.heroUpdateMeta.textContent = `refresh every ${dashboard.check_interval || 60}s`;
    elements.searchInput.disabled = !state.health?.configured;
    elements.searchInput.placeholder = state.health?.configured
        ? "Search Twitch by login or channel name"
        : "Add credentials to unlock Twitch search";
}

function renderMissionStrip() {
    const dashboard = state.dashboard || buildFallbackDashboard();
    const overview = dashboard.overview || {};
    const hottest = overview.hottest_stream;
    const consistent = overview.most_consistent;

    elements.missionMode.textContent = state.health?.configured ? "Live telemetry" : "Credential mode";
    elements.missionModeMeta.textContent = state.health?.configured
        ? "Twitch API connected and watchlist telemetry is active."
        : "Using placeholder data until Twitch credentials are added.";

    elements.missionCategory.textContent = overview.dominant_category || "Awaiting data";
    elements.missionCategoryMeta.textContent = `${formatNumber(dashboard.summary.live)} live / ${formatNumber(dashboard.summary.tracked)} tracked`;

    elements.missionHeat.textContent = hottest?.display_name || "No live leader";
    elements.missionHeatMeta.textContent = hottest
        ? `${formatCompact(hottest.viewer_count)} viewers right now`
        : consistent
        ? `${consistent.display_name} leads consistency at ${consistent.score}/100`
        : "Signal leadership will appear once the watchlist has more activity.";

    elements.missionRefresh.textContent = `${dashboard.check_interval || 60}s cycle`;
    elements.missionRefreshMeta.textContent = state.health?.cache_age_seconds != null
        ? `Dashboard cache ${formatCacheAge(state.health.cache_age_seconds)}`
        : "Polling begins after the first dashboard refresh.";
}

function renderSelect() {
    const options = state.dashboard?.streamers?.length ? state.dashboard.streamers : buildPlaceholderStreamers(state.config || {});
    clearElement(elements.streamerSelect);

    for (const streamer of options) {
        const option = createElement("option", { text: streamer.display_name || streamer.login });
        option.value = streamer.login;
        elements.streamerSelect.appendChild(option);
    }

    if (!state.selectedLogin && options[0]) {
        state.selectedLogin = options[0].login;
    }
    elements.streamerSelect.value = state.selectedLogin;
}

function renderKPIs() {
    const streamer = getSelectedStreamer();
    const ml = state.ml;

    elements.kpiPredict.textContent = ml?.status === "success" ? formatCompact(ml.predicted_peak) : "--";
    elements.kpiCurrent.textContent = streamer ? formatCompact(streamer.viewer_count) : "--";
    elements.kpiConsistency.textContent = streamer ? `${streamer.analytics.consistency_score}/100` : "--";
    elements.kpiSession.textContent = streamer ? formatMinutes(streamer.analytics.avg_duration_minutes) : "--";

    if (ml?.status === "success") {
        setTrendBadge(ml.trend);
        elements.kpiError.textContent = `+/-${formatCompact(Math.round(ml.model_std_error || 0))}`;
        elements.kpiErrorMeta.textContent = `MAE ${formatCompact(Math.round(ml.model_mae || 0))} vs naive ${formatCompact(Math.round(ml.baseline_mae || 0))}`;
        elements.kpiConfidenceBadge.textContent = `${titleCase(ml.confidence_label)} confidence`;
        elements.kpiConfidenceBadge.className = `pill ${getTrendClass(ml.confidence_label)}`;

        if (ml.anomalies_detected && ml.anomalies?.length) {
            const latest = ml.anomalies[ml.anomalies.length - 1];
            elements.kpiAnomaly.textContent = "Elevated";
            elements.kpiAnomalyMeta.textContent = `Latest z-score ${latest.z_score.toFixed(2)} suggests unusual audience acceleration.`;
        } else {
            elements.kpiAnomaly.textContent = "Normal";
            elements.kpiAnomalyMeta.textContent = "No abnormal growth spikes are currently flagged.";
        }
    } else {
        setTrendBadge("neutral");
        elements.kpiError.textContent = "--";
        elements.kpiErrorMeta.textContent = "More historical samples are needed before model diagnostics become reliable.";
        elements.kpiConfidenceBadge.textContent = "Model quality";
        elements.kpiConfidenceBadge.className = "pill neutral";
        elements.kpiAnomaly.textContent = "Calibrating";
        elements.kpiAnomalyMeta.textContent = "More historical samples are needed before the anomaly engine becomes reliable.";
    }
}

function renderProfile() {
    const streamer = getSelectedStreamer();
    if (!streamer) {
        return;
    }

    elements.selectedName.textContent = streamer.display_name;
    elements.selectedLogin.textContent = `@${streamer.login}`;
    elements.selectedTitle.textContent = streamer.title || "No live title available.";
    elements.selectedDescription.textContent = streamer.description || "No channel description available yet.";
    elements.selectedCategory.textContent = streamer.game_name || streamer.analytics.top_category || "Unknown";
    elements.selectedUptime.textContent = streamer.is_live ? streamer.uptime : "Offline";
    elements.selectedPeak.textContent = formatCompact(streamer.analytics.best_peak_viewers);
    elements.selectedSessions.textContent = formatNumber(streamer.analytics.session_count);
    elements.watchLink.href = streamer.url;
    elements.selectedStatusPill.textContent = streamer.is_live ? "Live signal" : "Offline";
    elements.selectedStatusPill.className = `pill ${streamer.is_live ? "growing" : "neutral"}`;
    elements.removeStreamerButton.disabled = !(state.dashboard?.streamers?.length);

    clearElement(elements.selectedGroups);
    const groups = streamer.groups?.length ? streamer.groups : ["Ungrouped"];
    for (const group of groups) {
        elements.selectedGroups.appendChild(createElement("span", { className: "group-chip", text: group }));
    }

    const insightBits = [];
    if (streamer.is_live) {
        insightBits.push(`${streamer.display_name} is currently live in ${streamer.game_name || "an active category"}.`);
    } else {
        insightBits.push(`${streamer.display_name} is currently offline, so the forecast layer is leaning on stored historical samples.`);
    }
    insightBits.push(`Consistency is ${streamer.analytics.consistency_score}/100 across ${streamer.analytics.session_count} tracked sessions.`);
    if (state.ml?.status === "success") {
        insightBits.push(`The model estimates a short-horizon peak near ${formatCompact(state.ml.predicted_peak)} viewers with ${state.ml.confidence_label} confidence.`);
    } else {
        insightBits.push("The model is still collecting enough samples to produce a trustworthy short-term forecast.");
    }
    elements.selectedInsight.textContent = insightBits.join(" ");
    const snapshots = state.history?.recent_snapshots || streamer.recent_snapshots || [];
    elements.forecastSamples.textContent = `${snapshots.length || 0} samples`;
}

function renderLeaderboard() {
    clearElement(elements.leaderboardList);
    const leaderboards = state.dashboard?.leaderboards;
    if (!leaderboards) {
        return;
    }

    const sections = [
        ["Live Now", leaderboards.live_now, "viewers"],
        ["Best Peak", leaderboards.best_peak, "peak"],
        ["Most Active", leaderboards.most_active, "sessions"],
        ["Momentum", leaderboards.trend, "score"],
    ];

    for (const [title, rows, suffix] of sections) {
        const card = createElement("section", { className: "leaderboard-card" });
        card.appendChild(createElement("h3", { text: title }));
        if (!rows.length) {
            card.appendChild(createElement("p", { className: "empty-copy", text: "More tracked history is needed here." }));
        } else {
            const list = createElement("ol");
            rows.forEach((row, index) => {
                const item = createElement("li");
                item.appendChild(createElement("span", { className: "leaderboard-rank", text: String(index + 1).padStart(2, "0") }));

                const entry = createElement("div", { className: "leaderboard-entry" });
                entry.appendChild(createElement("span", { className: "leaderboard-name", text: row.display_name }));
                entry.appendChild(createElement("strong", { text: `${formatCompact(row.value)} ${suffix}` }));
                entry.appendChild(createElement("small", { text: row.meta }));
                item.appendChild(entry);
                list.appendChild(item);
            });
            card.appendChild(list);
        }
        elements.leaderboardList.appendChild(card);
    }
}

function renderGroupSummary() {
    clearElement(elements.groupSummary);
    const groups = state.dashboard?.group_summary || [];
    if (!groups.length) {
        appendEmptyState(elements.groupSummary, "Group data appears after the watchlist is configured.");
        return;
    }

    const maxViewers = Math.max(...groups.map((group) => group.current_viewers), 1);
    for (const group of groups) {
        const row = createElement("article", { className: "stack-row" });
        const top = createElement("div", { className: "stack-copy" });
        top.appendChild(createElement("span", { text: group.name }));
        top.appendChild(createElement("strong", { text: `${formatCompact(group.current_viewers)} viewers` }));
        row.appendChild(top);

        const track = createElement("div", { className: "stack-track" });
        const fill = createElement("span");
        fill.style.width = `${(group.current_viewers / maxViewers) * 100}%`;
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(createElement("p", { className: "session-meta", text: `${group.live}/${group.tracked} channels live` }));
        elements.groupSummary.appendChild(row);
    }
}

function renderBarList(container, items) {
    clearElement(container);
    if (!items.length) {
        appendEmptyState(container, "Not enough historical structure yet.");
        return;
    }

    const maxValue = Math.max(...items.map((item) => item.value), 1);
    for (const item of items) {
        const row = createElement("article", { className: "bar-row" });
        const top = createElement("div", { className: "bar-copy" });
        top.appendChild(createElement("span", { text: item.name }));
        top.appendChild(createElement("strong", { text: formatCompact(item.value) }));
        row.appendChild(top);

        const track = createElement("div", { className: "bar-track" });
        const fill = createElement("span");
        fill.style.width = `${(item.value / maxValue) * 100}%`;
        track.appendChild(fill);
        row.appendChild(track);
        container.appendChild(row);
    }
}

function renderAlerts() {
    clearElement(elements.alertsFeed);
    const alerts = state.dashboard?.alerts || [];
    if (!alerts.length) {
        appendEmptyState(elements.alertsFeed, "No watchlist events have fired yet.");
        return;
    }

    for (const alert of alerts) {
        const row = createElement("article", { className: `alert-row severity-${alert.severity}` });
        const copy = createElement("div");
        copy.appendChild(createElement("strong", { text: alert.display_name }));
        copy.appendChild(createElement("p", { text: alert.message }));
        row.appendChild(copy);
        row.appendChild(createElement("div", { className: "alert-time", text: formatDateTime(alert.created_at) }));
        elements.alertsFeed.appendChild(row);
    }
}

function formatSession(session) {
    return `${formatDateTime(session.started_at)} · ${session.game_name || "Unknown"} · peak ${formatCompact(session.peak_viewers || 0)} · avg ${formatCompact(session.avg_viewers || 0)} · ${formatMinutes(session.duration_minutes || 0)}`;
}

function renderSessions() {
    clearElement(elements.sessionList);
    const sessions = state.history?.recent_sessions || getSelectedStreamer()?.recent_sessions || [];
    if (!sessions.length) {
        appendEmptyState(elements.sessionList, "Run the tracker longer to build a stronger session archive.");
        return;
    }

    for (const session of sessions) {
        const row = createElement("article", { className: "session-row" });
        const copy = createElement("div", { className: "session-copy" });
        copy.appendChild(createElement("strong", { text: session.title || "Untitled session" }));
        copy.appendChild(createElement("p", { text: formatSession(session) }));
        row.appendChild(copy);
        row.appendChild(createElement("div", { className: `session-meta session-badge ${session.ended_at ? "is-complete" : "is-active"}`, text: session.ended_at ? "Completed" : "Active" }));
        elements.sessionList.appendChild(row);
    }
}

function renderTrackedGrid() {
    clearElement(elements.trackedGrid);
    const streamers = state.dashboard?.streamers || [];
    if (!streamers.length) {
        appendEmptyState(elements.trackedGrid, "Tracked creators will appear here after the dashboard connects.");
        return;
    }

    for (const streamer of streamers) {
        const card = createElement("article", { className: `tracked-card ${state.selectedLogin === streamer.login ? "is-focused" : ""}` });
        const top = createElement("div", { className: "tracked-topline" });
        const identity = createElement("div", { className: "tracked-identity" });
        identity.appendChild(
            createElement("img", {
                className: "tracked-avatar",
                attrs: {
                    alt: `${streamer.display_name} avatar`,
                    src: streamer.profile_image_url || "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
                    loading: "lazy",
                },
            })
        );
        const copy = createElement("div");
        copy.appendChild(createElement("h3", { text: streamer.display_name }));
        copy.appendChild(createElement("p", { text: streamer.title || "No live title available." }));
        identity.appendChild(copy);
        top.appendChild(identity);
        top.appendChild(createElement("span", { className: `pill ${streamer.is_live ? "growing" : "neutral"}`, text: streamer.is_live ? "Live" : "Offline" }));
        card.appendChild(top);

        const meta = createElement("div", { className: "tracked-meta" });
        meta.appendChild(createElement("span", { text: `${formatCompact(streamer.viewer_count)} viewers` }));
        meta.appendChild(createElement("span", { text: `${streamer.analytics.trend_score} trend` }));
        card.appendChild(meta);

        const stats = createElement("div", { className: "tracked-stats" });
        stats.appendChild(createElement("span", { className: "tracked-stat", text: streamer.game_name || "Offline" }));
        stats.appendChild(createElement("span", { className: "tracked-stat", text: `${streamer.analytics.best_peak_viewers ? formatCompact(streamer.analytics.best_peak_viewers) : "—"} peak` }));
        stats.appendChild(createElement("span", { className: "tracked-stat", text: `${streamer.analytics.session_count} sessions` }));
        card.appendChild(stats);

        const actions = createElement("div", { className: "tracked-actions" });
        const focusButton = createElement("button", {
            className: "tracked-button",
            text: state.selectedLogin === streamer.login ? "Focused" : "Focus",
            attrs: { type: "button" },
        });
        focusButton.addEventListener("click", () => {
            focusStreamer(streamer.login).catch((error) => {
                showBanner(`Unable to focus streamer: ${error.message}`, "error");
            });
        });
        const removeButton = createElement("button", {
            className: "tracked-button tracked-button-secondary",
            text: "Remove",
            attrs: { type: "button" },
        });
        removeButton.addEventListener("click", () => {
            removeStreamer(streamer.login).catch((error) => {
                showBanner(`Unable to remove streamer: ${error.message}`, "error");
            });
        });
        actions.appendChild(focusButton);
        actions.appendChild(removeButton);
        card.appendChild(actions);
        elements.trackedGrid.appendChild(card);
    }
}

function renderPlayer() {
    const streamer = getSelectedStreamer();
    if (!streamer || !streamer.login) {
        elements.playerFrame.classList.add("hidden");
        elements.playerState.classList.remove("hidden");
        elements.playerState.textContent = "Choose a streamer to load the embedded Twitch player.";
        elements.playerMeta.textContent = "The player uses Twitch's official embed and follows the current host domain automatically.";
        return;
    }

    const src = getTwitchEmbedUrl(streamer.login);
    if (elements.playerFrame.getAttribute("src") !== src) {
        elements.playerFrame.setAttribute("src", src);
    }

    elements.playerFrame.classList.remove("hidden");
    elements.playerState.classList.add("hidden");
    elements.playerMeta.textContent = streamer.is_live
        ? `Watching ${streamer.display_name} live inside the app. If playback is blocked, open the channel in a new tab.`
        : `${streamer.display_name} is offline right now. The embedded player stays ready for the next live session.`;
}

function renderChart() {
    const snapshots = state.history?.recent_snapshots || getSelectedStreamer()?.recent_snapshots || [];
    const ml = state.ml?.status === "success" ? state.ml : null;

    if (!chartAvailable) {
        elements.chartState.textContent = "Chart.js did not load, so the graph is unavailable right now. The rest of the dashboard will still work.";
        elements.chartState.classList.remove("hidden");
        return;
    }

    if (!snapshots.length) {
        elements.chartState.textContent = "No viewer history yet. Let the tracker collect more samples to unlock the forecast canvas.";
        elements.chartState.classList.remove("hidden");
    } else {
        elements.chartState.classList.add("hidden");
    }

    const labels = [];
    const actual = [];
    let lastTime = null;

    for (const snapshot of snapshots) {
        const date = new Date(snapshot.timestamp);
        labels.push(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        actual.push(snapshot.viewers ?? snapshot.viewer_count ?? 0);
        lastTime = date;
    }

    const forecast = new Array(actual.length).fill(null);
    const upper = new Array(actual.length).fill(null);
    const lower = new Array(actual.length).fill(null);

    if (ml && lastTime) {
        if (actual.length) {
            const lastValue = actual[actual.length - 1];
            forecast[actual.length - 1] = lastValue;
            upper[actual.length - 1] = lastValue;
            lower[actual.length - 1] = lastValue;
        }

        for (const point of ml.forecast) {
            const futureTime = new Date(lastTime.getTime() + point.minute_offset * 60000);
            labels.push(futureTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            actual.push(null);
            forecast.push(point.predicted_viewers);
            upper.push(point.upper_bound);
            lower.push(point.lower_bound);
        }
    }

    const ctx = elements.mainChart.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, "rgba(215, 255, 56, 0.34)");
    gradient.addColorStop(1, "rgba(215, 255, 56, 0)");

    if (state.chart) {
        state.chart.data.labels = labels;
        state.chart.data.datasets[0].data = actual;
        state.chart.data.datasets[1].data = forecast;
        state.chart.data.datasets[2].data = upper;
        state.chart.data.datasets[3].data = lower;
        state.chart.update();
        return;
    }

    state.chart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Actual",
                    data: actual,
                    borderColor: "#d7ff38",
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.32,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderWidth: 3,
                },
                {
                    label: "Forecast",
                    data: forecast,
                    borderColor: "#6fffd2",
                    borderWidth: 3,
                    borderDash: [8, 8],
                    pointRadius: 0,
                    tension: 0.28,
                },
                {
                    label: "Upper bound",
                    data: upper,
                    borderColor: "rgba(255, 176, 0, 0.75)",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.28,
                },
                {
                    label: "Lower bound",
                    data: lower,
                    borderColor: "rgba(255, 176, 0, 0.28)",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.28,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: {
                        usePointStyle: true,
                        boxWidth: 10,
                    },
                },
                tooltip: {
                    backgroundColor: "#090908",
                    titleColor: "#f4f1e8",
                    bodyColor: "#c5bdab",
                    borderColor: "#f4f1e8",
                    borderWidth: 2,
                },
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(244, 241, 232, 0.12)",
                    },
                    ticks: {
                        maxTicksLimit: 8,
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(244, 241, 232, 0.12)",
                    },
                },
            },
        },
    });
}

function renderSearchResults() {
    clearElement(elements.searchResults);
    const query = state.searchQuery.trim();
    if (!query || query.length < 2) {
        elements.searchResults.classList.add("hidden");
        return;
    }

    elements.searchResults.classList.remove("hidden");
    if (!state.searchResults.length) {
        elements.searchResults.appendChild(createElement("div", { className: "search-empty", text: "No matching channels found." }));
        return;
    }

    for (const result of state.searchResults) {
        const row = createElement("div", { className: "search-row" });

        const profile = createElement("div", { className: "search-row-main" });
        const avatar = createElement("img", {
            className: "search-avatar",
            attrs: {
                alt: `${result.display_name} avatar`,
                src: result.profile_image_url || "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
                loading: "lazy",
            },
        });
        profile.appendChild(avatar);

        const copy = createElement("div", { className: "search-row-copy" });
        copy.appendChild(createElement("strong", { text: result.display_name }));
        copy.appendChild(
            createElement("span", {
                text: result.is_live ? `${result.game_name || "Live"} • live now` : result.game_name || "Offline",
            })
        );
        profile.appendChild(copy);
        row.appendChild(profile);

        const button = createElement("button", {
            className: `search-action ${result.is_tracked ? "disabled" : ""}`,
            text: result.is_tracked ? "Tracked" : "Add",
            attrs: { type: "button", disabled: result.is_tracked ? "disabled" : null },
        });
        if (!result.is_tracked) {
            button.addEventListener("click", () => {
                addStreamer(result.login).catch((error) => {
                    showBanner(`Unable to add streamer: ${error.message}`, "error");
                });
            });
        }
        row.appendChild(button);
        elements.searchResults.appendChild(row);
    }
}

function renderAll() {
    renderHero();
    renderMissionStrip();
    renderSelect();
    renderKPIs();
    renderProfile();
    renderLeaderboard();
    renderGroupSummary();
    renderBarList(elements.categoryMix, state.dashboard?.category_mix || []);
    renderAlerts();
    renderSessions();
    renderTrackedGrid();
    renderChart();
    renderPlayer();
    renderSearchResults();
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || data.error || "Request failed");
    }
    return data;
}

async function sendJson(url, method, body) {
    return fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
}

async function refreshStreamData() {
    if (!state.selectedLogin) {
        state.history = null;
        state.ml = null;
        return;
    }

    const [historyResult, mlResult] = await Promise.allSettled([
        fetchJson(`/api/history/${encodeURIComponent(state.selectedLogin)}`),
        fetchJson(`/api/ml/predict/${encodeURIComponent(state.selectedLogin)}`),
    ]);

    state.history = historyResult.status === "fulfilled" ? historyResult.value : null;
    state.ml = mlResult.status === "fulfilled" ? mlResult.value : null;
}

async function refreshDashboard({ force = false } = {}) {
    state.config = await fetchJson("/api/config");

    try {
        state.health = await fetchJson("/api/health");
    } catch (error) {
        state.health = { configured: false, error: error.message };
    }

    if (!state.health?.configured) {
        state.dashboard = buildFallbackDashboard();
        if (!state.selectedLogin && state.dashboard.streamers[0]) {
            state.selectedLogin = state.dashboard.streamers[0].login;
        }
        showBanner("Credential mode is active. Add Twitch credentials in twitch_checker/config.json or .env to unlock live telemetry and search.", "warning");
        await refreshStreamData();
        renderAll();
        return;
    }

    hideBanner();
    const dashboardUrl = force ? "/api/dashboard?refresh=1" : "/api/dashboard";
    state.dashboard = await fetchJson(dashboardUrl);
    if (!state.selectedLogin || !state.dashboard.streamers.some((streamer) => streamer.login === state.selectedLogin)) {
        state.selectedLogin = state.dashboard.streamers[0]?.login || "";
    }
    await refreshStreamData();
    renderAll();
}

async function focusStreamer(login) {
    state.selectedLogin = login;
    renderAll();
    await refreshStreamData();
    renderAll();
}

function setupPolling(intervalSeconds) {
    if (state.intervalId) {
        window.clearInterval(state.intervalId);
    }
    state.intervalId = window.setInterval(() => {
        refreshDashboard().catch((error) => {
            showBanner(`Refresh failed: ${error.message}`, "error");
        });
    }, Math.max(intervalSeconds, 20) * 1000);
}

function hideSearchResults() {
    state.searchQuery = "";
    state.searchResults = [];
    if (elements.searchInput) {
        elements.searchInput.value = "";
    }
    renderSearchResults();
}

async function performSearch(query) {
    if (!state.health?.configured) {
        state.searchResults = [];
        renderSearchResults();
        return;
    }

    state.searchResults = await fetchJson(`/api/search?q=${encodeURIComponent(query)}`);
    renderSearchResults();
}

async function addStreamer(login) {
    await sendJson("/api/watchlist", "POST", { login });
    hideSearchResults();
    await refreshDashboard({ force: true });
    await focusStreamer(login);
}

async function removeStreamer(login) {
    const confirmed = window.confirm(`Remove ${login} from the watchlist?`);
    if (!confirmed) {
        return;
    }

    await fetchJson(`/api/watchlist/${encodeURIComponent(login)}`, { method: "DELETE" });
    if (state.selectedLogin === login) {
        state.selectedLogin = "";
        state.history = null;
        state.ml = null;
    }
    await refreshDashboard({ force: true });
}

function bindSearchInput() {
    elements.searchInput.addEventListener("input", (event) => {
        const query = event.target.value.trim();
        state.searchQuery = query;

        window.clearTimeout(state.searchTimer);
        if (query.length < 2) {
            state.searchResults = [];
            renderSearchResults();
            return;
        }

        state.searchTimer = window.setTimeout(() => {
            performSearch(query).catch((error) => {
                showBanner(`Search failed: ${error.message}`, "error");
            });
        }, 250);
    });

    document.addEventListener("click", (event) => {
        const searchShell = event.target.closest(".search-shell");
        if (!searchShell && !elements.searchResults.classList.contains("hidden")) {
            state.searchQuery = "";
            state.searchResults = [];
            elements.searchResults.classList.add("hidden");
        }
    });
}

async function bootstrap() {
    elements.refreshButton.addEventListener("click", () => {
        refreshDashboard({ force: true }).catch((error) => {
            showBanner(`Refresh failed: ${error.message}`, "error");
        });
    });

    elements.streamerSelect.addEventListener("change", (event) => {
        focusStreamer(event.target.value).catch((error) => {
            showBanner(`Unable to load streamer details: ${error.message}`, "error");
        });
    });

    elements.removeStreamerButton.addEventListener("click", () => {
        if (!state.selectedLogin) {
            return;
        }
        removeStreamer(state.selectedLogin).catch((error) => {
            showBanner(`Unable to remove streamer: ${error.message}`, "error");
        });
    });

    bindSearchInput();

    try {
        await refreshDashboard();
        setupPolling(state.config?.check_interval || 60);
    } catch (error) {
        showBanner(`Application bootstrap failed: ${error.message}`, "error");
    }
}

bootstrap();
