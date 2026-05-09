/* ═══════════════════════════════════════════════════════════
   StreamPulse — Mission Control Frontend Engine
   Real-time Twitch Intelligence Dashboard
═══════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ──────────────────────────────────────────────
const POLL_INTERVAL_MS  = 30_000;
const COUNTER_FRAMES    = 30;

// ── State ──────────────────────────────────────────────────
let streamerList        = [];     // Loaded from /api/config
let currentLogin        = '';
let currentView         = 'dashboard';
let mainChartInstance   = null;
let compareChartInstance = null;
let categoryChartInstance = null;
let lastDashboardData   = null;   // full /api/dashboard response
let animFrameIds        = {};     // keyed animated counter RAF IDs
let lastCounterValues   = {};     // last rendered values for smooth delta
let searchTimeout       = null;

// ═══════════════════════════════════════════════════════════
// ANIMATED BACKGROUND CANVAS
// ═══════════════════════════════════════════════════════════
(function initBackground() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function randBetween(a, b) { return Math.random() * (b - a) + a; }

    // Create grid dots
    function initParticles() {
        particles = [];
        const COLS = Math.ceil(W / 80);
        const ROWS = Math.ceil(H / 80);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                particles.push({
                    x: c * 80 + randBetween(-6, 6),
                    y: r * 80 + randBetween(-6, 6),
                    baseX: c * 80,
                    baseY: r * 80,
                    opacity: randBetween(0.03, 0.18),
                    phase: randBetween(0, Math.PI * 2),
                    speed: randBetween(0.3, 0.9),
                    size: randBetween(1, 2.2),
                });
            }
        }
    }
    initParticles();
    window.addEventListener('resize', initParticles);

    // Color accents cycling
    const COLORS = [
        'rgba(168, 85, 247,',
        'rgba(34, 211, 238,',
        'rgba(74, 222, 128,',
    ];
    let tick = 0;

    function drawFrame() {
        ctx.clearRect(0, 0, W, H);
        tick += 0.01;

        // Draw subtle grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < W; x += 80) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 80) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Draw animated particles
        particles.forEach((p, i) => {
            const breath = Math.sin(tick * p.speed + p.phase);
            const alpha = p.opacity + breath * 0.06;
            const colorStr = COLORS[i % COLORS.length];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `${colorStr}${Math.max(0, alpha).toFixed(3)})`;
            ctx.fill();
        });

        requestAnimationFrame(drawFrame);
    }
    drawFrame();
})();

// ═══════════════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════════════
function updateClock() {
    const el = document.getElementById('topbarTime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ═══════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════
function animateCounter(elementId, targetValue, formatter) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (animFrameIds[elementId]) cancelAnimationFrame(animFrameIds[elementId]);
    const start = lastCounterValues[elementId] || 0;
    const delta = targetValue - start;
    let frame = 0;

    function step() {
        frame++;
        const progress = Math.min(frame / COUNTER_FRAMES, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + delta * eased);
        el.textContent = formatter ? formatter(current) : current.toLocaleString();
        if (frame < COUNTER_FRAMES) {
            animFrameIds[elementId] = requestAnimationFrame(step);
        } else {
            lastCounterValues[elementId] = targetValue;
        }
    }
    step();
}

function fmtViewers(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

// ═══════════════════════════════════════════════════════════
// STREAMER PILLS — INIT
// ═══════════════════════════════════════════════════════════
function initStreamerPills() {
    const container = document.getElementById('streamerPills');
    if (!container) return;
    container.innerHTML = '';

    streamerList.forEach(login => {
        const btn = document.createElement('button');
        btn.className = 'streamer-pill';
        btn.id        = `pill-${login}`;
        btn.textContent = login;
        btn.onclick   = () => selectStreamer(login);
        container.appendChild(btn);
    });

    // Update current login if empty
    if (!currentLogin && streamerList.length > 0) {
        currentLogin = streamerList[0];
    }

    // Populate compare dropdowns
    ['compareSelectA', 'compareSelectB'].forEach((id, idx) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '';
        streamerList.forEach(login => {
            const opt = document.createElement('option');
            opt.value = login;
            opt.textContent = login;
            if ((idx === 0 && login === streamerList[0]) || (idx === 1 && login === streamerList[1])) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    });

    if (currentLogin) selectStreamer(currentLogin);
}

// ═══════════════════════════════════════════════════════════
// SEARCH & ADD STREAMER
// ═══════════════════════════════════════════════════════════
async function handleSearch(e) {
    const query = e.target.value.trim();
    const resultsContainer = document.getElementById('searchResults');
    
    if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            if (data.length === 0) {
                resultsContainer.innerHTML = '<div class="search-result-item">No results found</div>';
            } else {
                resultsContainer.innerHTML = data.map(s => `
                    <div class="search-result-item">
                        <img src="${s.profile_image_url}" class="search-result-avatar">
                        <div class="search-result-info">
                            <div class="search-result-name">${s.display_name}</div>
                            <div class="search-result-meta">${s.game_name || 'Searching...'}</div>
                        </div>
                        <button class="search-add-btn ${s.is_tracked ? 'tracked' : ''}" 
                                onclick="addStreamer('${s.login}')" 
                                ${s.is_tracked ? 'disabled' : ''}>
                            ${s.is_tracked ? 'Tracked' : 'Add'}
                        </button>
                    </div>
                `).join('');
            }
            resultsContainer.style.display = 'block';
        } catch (err) {
            console.error('Search failed:', err);
        }
    }, 300);
}

async function addStreamer(login) {
    try {
        const res = await fetch('/api/add_streamer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login })
        });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('streamerSearch').value = '';
            document.getElementById('searchResults').style.display = 'none';
            await loadConfig(); // Reload everything
            selectStreamer(login);
        } else {
            alert(data.error || 'Failed to add streamer');
        }
    } catch (err) {
        console.error('Add failed:', err);
    }
}

// Event Listeners for search
document.getElementById('streamerSearch')?.addEventListener('input', handleSearch);
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        document.getElementById('searchResults').style.display = 'none';
    }
});

// ═══════════════════════════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════════════════════════
function switchView(view) {
    currentView = view;
    ['dashboard', 'compare', 'leaderboard'].forEach(v => {
        const section = document.getElementById(`view-${v}`);
        const navBtn  = document.getElementById(`nav-${v}`);
        if (section) section.style.display = v === view ? 'flex' : 'none';
        if (navBtn)  navBtn.classList.toggle('active', v === view);
    });

    if (view === 'compare')     runCompare();
    if (view === 'leaderboard') renderLeaderboard();
}

// ═══════════════════════════════════════════════════════════
// SELECT STREAMER
// ═══════════════════════════════════════════════════════════
function selectStreamer(login) {
    currentLogin = login;
    document.querySelectorAll('.streamer-pill').forEach(btn => {
        btn.classList.remove('active');
    });
    const pill = document.getElementById(`pill-${login}`);
    if (pill) pill.classList.add('active');

    // Immediately render from cache so the UI snaps to the new streamer
    // without waiting for a full network round-trip
    if (lastDashboardData) {
        updateDashboardView(lastDashboardData);
        updateSidebar(lastDashboardData);
    }

    // Then fire new fetch + ML in background
    fetchDashboard();
}

// ═══════════════════════════════════════════════════════════
// MAIN DATA FETCH
// ═══════════════════════════════════════════════════════════
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        streamerList = data.streamers || [];
        initStreamerPills();
    } catch (err) {
        console.error('Failed to load config:', err);
    }
}

async function fetchDashboard() {
    if (streamerList.length === 0) {
        await loadConfig();
    }
    try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        lastDashboardData = data;

        updateTopbarStats(data);
        updateSidebar(data);
        updateDashboardView(data);

        // Refresh leaderboard / compare if visible
        if (currentView === 'leaderboard') renderLeaderboard();
        if (currentView === 'compare') runCompare();

        // Fetch ML prediction for selected streamer
        if (currentLogin) fetchMLPrediction(currentLogin);

        setStatus('ok');
    } catch (err) {
        console.error('[StreamPulse] fetchDashboard error:', err);
        setStatus('error');
    }
}

function setStatus(state) {
    const dot = document.getElementById('globalPulseDot');
    const label = document.getElementById('topbarTitle');
    if (state === 'ok') {
        dot?.classList.remove('error');
        if (label) label.textContent = `LIVE · Updated ${new Date().toLocaleTimeString('en-US', {hour12: false})}`;
    } else {
        dot?.classList.add('error');
        if (label) label.textContent = 'CONNECTION ERROR — RETRYING...';
    }
}

// ═══════════════════════════════════════════════════════════
// TOPBAR — Global stats chips
// ═══════════════════════════════════════════════════════════
function updateTopbarStats(data) {
    const summary = data.summary || {};
    animateCounter('chipLiveVal',     summary.live    || 0, null);
    animateCounter('chipViewersVal',  summary.current_viewers || 0, fmtViewers);
    animateCounter('chipTrackedVal',  summary.tracked || 0, null);
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR — Live list + alerts
// ═══════════════════════════════════════════════════════════
function updateSidebar(data) {
    const streamers = data.streamers || [];
    const alerts    = data.alerts    || [];

    // Update pill live indicators
    streamerList.forEach(login => {
        const pill = document.getElementById(`pill-${login}`);
        if (!pill) return;
        const card = streamers.find(c => c.login === login);
        if (card?.is_live) {
            pill.classList.add('pill-live');
        } else {
            pill.classList.remove('pill-live');
        }
    });

    // Sidebar live list — show live streamers sorted by viewers
    const liveStreamers = streamers
        .filter(c => c.is_live)
        .sort((a, b) => b.viewer_count - a.viewer_count);

    const liveList = document.getElementById('sidebarLiveList');
    if (liveList) {
        if (liveStreamers.length === 0) {
            liveList.innerHTML = '<div class="sidebar-live-placeholder">No one live right now</div>';
        } else {
            liveList.innerHTML = liveStreamers.map(s => `
                <div class="sidebar-live-item" onclick="selectStreamer('${s.login}')" title="${s.title || ''}">
                    <div class="sidebar-live-dot"></div>
                    <div class="sidebar-live-name">${s.display_name}</div>
                    <div class="sidebar-live-viewers">${fmtViewers(s.viewer_count)}</div>
                </div>
            `).join('');
        }
    }

    // Sidebar alerts
    const alertFeed = document.getElementById('sidebarAlerts');
    if (alertFeed) {
        if (alerts.length === 0) {
            alertFeed.innerHTML = '<div class="sidebar-live-placeholder">No events yet</div>';
        } else {
            alertFeed.innerHTML = alerts.slice(0, 8).map(a => `
                <div class="sidebar-alert-item severity-${a.severity}">
                    ${a.message}
                </div>
            `).join('');
        }
    }
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD VIEW — Profile card + KPI cards + chart
// ═══════════════════════════════════════════════════════════
function updateDashboardView(data) {
    const streamers = data.streamers || [];
    const card = streamers.find(s => s.login === currentLogin);
    
    // Always update global overview
    updateGlobalOverview(data);

    if (!card) {
        document.getElementById('deepIntelligence').style.display = 'none';
        return;
    }

    document.getElementById('deepIntelligence').style.display = 'block';
    
    updateProfileCard(card);
    updateKPICards(card);
    updateViewerChart(card);
    updateAnomalyBanner(null); // will be updated by ML
    updateIntelPanel(card);
    updateDeepIntelligence(card, data);
}

function updateGlobalOverview(data) {
    const summary = data.summary || {};
    // Top banner metrics
    animateCounter('globalMetricViewers', summary.current_viewers || 0, fmtViewers);
    animateCounter('globalMetricChannels', summary.live || 0, v => v.toLocaleString());
    animateCounter('globalMetricGames', data.category_mix?.length || 0, v => v.toLocaleString());

    // Top Streams List
    const topStreams = (data.streamers || [])
        .filter(s => s.is_live)
        .sort((a, b) => b.viewer_count - a.viewer_count)
        .slice(0, 5);
        
    const tsList = document.getElementById('topStreamsList');
    if (tsList) {
        tsList.innerHTML = topStreams.map(s => `
            <div class="g-list-item" onclick="selectStreamer('${s.login}')" style="cursor:pointer">
                <img src="${s.profile_image_url}" class="g-list-avatar">
                <div class="g-list-info">
                    <div class="g-list-name">${escHtml(s.display_name)}</div>
                    <div class="g-list-sub">${escHtml(s.game_name)}</div>
                </div>
                <div class="g-list-stat">
                    <div class="g-list-val" style="color:var(--accent-purple)">${fmtViewers(s.viewer_count)}</div>
                    <div class="g-list-stat-sub">Peak</div>
                </div>
            </div>
        `).join('');
    }

    // Top Channels (Trending)
    const topTrending = (data.streamers || [])
        .sort((a, b) => (b.analytics?.trend_score || 0) - (a.analytics?.trend_score || 0))
        .slice(0, 5);
        
    const tcList = document.getElementById('topChannelsList');
    if (tcList) {
        tcList.innerHTML = topTrending.map(s => `
            <div class="g-list-item" onclick="selectStreamer('${s.login}')" style="cursor:pointer">
                <img src="${s.profile_image_url}" class="g-list-avatar">
                <div class="g-list-info">
                    <div class="g-list-name">${escHtml(s.display_name)}</div>
                    <div class="g-list-sub">${escHtml(s.game_name || s.title || 'Offline')}</div>
                </div>
                <div class="g-list-stat">
                    <div class="g-list-val" style="color:var(--accent-cyan)">${s.analytics?.trend_score || 0}</div>
                    <div class="g-list-stat-sub">Trend Score</div>
                </div>
            </div>
        `).join('');
    }
}

function updateDeepIntelligence(card, data) {
    const analytics = card.analytics || {};
    const liveViewers = card.is_live ? card.viewer_count : 0;
    
    // Performance Grid
    el('kpiHoursStreamed').textContent = (analytics.avg_duration_minutes ? (analytics.avg_duration_minutes / 60).toFixed(1) : '0');
    el('kpiAvgViewersSum').textContent = fmtViewers(analytics.avg_peak_viewers || 0);
    el('kpiPeakViewersSum').textContent = fmtViewers(analytics.best_peak_viewers || liveViewers);
    el('kpiHoursWatched').textContent = fmtViewers((analytics.avg_peak_viewers || 0) * (analytics.session_count || 1));
    el('kpiFollowersGained').textContent = '+1.2K'; // Mock
    el('kpiFollowersPerHour').textContent = '45'; // Mock
    el('kpiGamesStreamed').textContent = card.groups?.length || 1;
    el('kpiActiveDays').textContent = analytics.session_count || 1;

    // Lifetime
    el('ltTotalHours').textContent = '1,240';
    el('ltHighestViewers').textContent = fmtViewers(analytics.best_peak_viewers || liveViewers);
    el('ltTotalFollowers').textContent = '2.4M';
    el('ltTotalGames').textContent = '42';

    // Mock Popular Clips
    const clips = document.getElementById('clipsGrid');
    if (clips) {
        clips.innerHTML = [1, 2, 3].map(i => `
            <div class="clip-card">
                <img class="clip-thumb" src="${card.profile_image_url}" style="filter: brightness(0.7) blur(2px);">
                <div class="clip-views">1.2M views</div>
                <div class="clip-title">Stream Highlight ${i}</div>
            </div>
        `).join('');
    }

    // Mock Heatmap
    const heatmap = document.getElementById('scheduleHeatmap');
    if (heatmap) {
        let cells = '';
        for (let j=0; j<7; j++) {
            cells += '<div class="heatmap-col">';
            for(let i=0; i<24; i++) {
                const lvl = Math.floor(Math.random() * 5);
                cells += `<div class="heatmap-cell" data-level="${lvl}" title="${j} ${i}:00"></div>`;
            }
            cells += '</div>';
        }
        heatmap.innerHTML = `<div class="heatmap-grid">${cells}</div>`;
    }
}

function updateProfileCard(card) {
    const avatarImg = document.getElementById('profileAvatar');
    const placeholder = document.getElementById('profileAvatarPlaceholder');
    const liveRing = document.getElementById('profileLiveRing');
    const nameEl = document.getElementById('profileName');
    const liveBadge = document.getElementById('profileLiveBadge');
    const peakEl = document.getElementById('profilePeak');
    const sessionsEl = document.getElementById('profileSessions');
    const consistencyEl = document.getElementById('profileConsistency');
    const linkEl = document.getElementById('profileLink');

    if (nameEl) nameEl.textContent = card.display_name;

    if (avatarImg && card.profile_image_url) {
        avatarImg.src = card.profile_image_url;
        avatarImg.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else if (placeholder) {
        if (avatarImg) avatarImg.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.textContent = card.display_name?.charAt(0)?.toUpperCase() || '?';
    }

    if (liveRing) {
        liveRing.classList.toggle('live', card.is_live);
    }

    if (liveBadge) {
        liveBadge.textContent = card.is_live ? '🔴 LIVE NOW' : 'OFFLINE';
        liveBadge.className = 'profile-tag' + (card.is_live ? ' live-tag' : '');
    }

    const analytics = card.analytics || {};
    if (peakEl) {
        peakEl.textContent = analytics.best_peak_viewers
            ? fmtViewers(analytics.best_peak_viewers)
            : '—';
    }
    if (sessionsEl) sessionsEl.textContent = analytics.session_count ?? '—';
    if (consistencyEl) consistencyEl.textContent = analytics.consistency_score != null
        ? `${analytics.consistency_score}%`
        : '—';

    if (linkEl) {
        linkEl.href = card.url || `https://www.twitch.tv/${card.login}`;
    }

    // Update Archetype Badge
    const archetype = analytics.archetype || {};
    const archBadge = document.getElementById('archetypeBadge');
    if (archBadge) {
        const nameEl = archBadge.querySelector('.archetype-name');
        if (nameEl) nameEl.textContent = archetype.name || 'Analyzing...';
        archBadge.title = archetype.desc || 'Still gathering behavioral data patterns.';
    }

    // Add game + group tags
    const profileTags = document.getElementById('profileTags');
    if (profileTags) {
        const tags = [];
        if (card.is_live) tags.push(`<span class="profile-tag live-tag">🔴 LIVE</span>`);
        if (card.game_name) tags.push(`<span class="profile-tag">${escHtml(card.game_name)}</span>`);
        if (card.broadcaster_type && card.broadcaster_type !== 'standard') {
            tags.push(`<span class="profile-tag">${card.broadcaster_type.toUpperCase()}</span>`);
        }
        (card.groups || []).slice(0, 2).forEach(g => {
            tags.push(`<span class="profile-tag">${escHtml(g)}</span>`);
        });
        profileTags.innerHTML = tags.join('');
    }
}

function updateIntelPanel(card) {
    const analytics = card.analytics || {};
    
    // Optimal Window
    const hourly = analytics.hourly_activity || [];
    const peakHour = hourly.indexOf(Math.max(...hourly));
    const windowEl = document.getElementById('intelOptimalWindow');
    if (windowEl) {
        windowEl.textContent = peakHour >= 0 ? `${peakHour}:00 - ${peakHour + 2}:00` : 'Gathering data...';
    }

    // Description (Archetype)
    const descEl = document.getElementById('archetypeDesc');
    if (descEl && analytics.archetype) {
        descEl.textContent = analytics.archetype.desc;
    }

    // Similar Streamers (Simulated or based on comparison)
    const similarEl = document.getElementById('intelSimilarList');
    if (similarEl && lastDashboardData) {
        const others = lastDashboardData.streamers.filter(s => s.login !== card.login).slice(0, 3);
        if (others.length > 0) {
            similarEl.innerHTML = others.map(o => `
                <span class="similar-streamer-tag" onclick="selectStreamer('${o.login}')" style="cursor:pointer">${o.display_name}</span>
            `).join('');
        } else {
            similarEl.textContent = 'None tracked';
        }
    }
}

function updateKPICards(card) {
    // Live viewers
    const viewers = card.is_live ? card.viewer_count : 0;
    animateCounter('kpiViewers', viewers, v => card.is_live ? fmtViewers(v) : 'OFFLINE');
    el('kpiGame').textContent = card.is_live
        ? (card.game_name || 'Unknown game')
        : (card.title ? card.title.substring(0, 50) : 'Not streaming');

    const statusBadge = document.getElementById('kpiBadgeStatus');
    if (statusBadge) {
        statusBadge.className = 'kpi-badge' + (card.is_live ? ' live-tag' : '');
        statusBadge.textContent = card.is_live ? '🔴 LIVE' : 'OFFLINE';
    }

    // Uptime
    el('kpiUptime').textContent = card.is_live ? (card.uptime || '—') : 'N/A';
    const titleTxt = card.title
        ? card.title.substring(0, 55) + (card.title.length > 55 ? '…' : '')
        : 'No stream data';
    el('kpiTitle').textContent = titleTxt;
}

// ═══════════════════════════════════════════════════════════
// ML PREDICTION FETCH + KPI UPDATE
// ═══════════════════════════════════════════════════════════
async function fetchMLPrediction(login) {
    try {
        // First try the new /api/ml/predict/<login> endpoint
        const res = await fetch(`/api/ml/predict/${login}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const pred = data.prediction || data;

        // Always pre-generate a basic insight immediately so the card is never blank
        generateAIInsightBasic(login);

        if (pred.status === 'success') {
            animateCounter('kpiPredict', pred.predicted_peak, fmtViewers);
            el('kpiError').textContent = `Confidence: ±${fmtViewers(Math.round(pred.model_std_error || 0))}`;

            const tBadge = document.getElementById('kpiBadgeTrend');
            if (tBadge) {
                tBadge.textContent = (pred.trend || 'stable').toUpperCase();
                tBadge.className   = `kpi-badge ${pred.trend || 'stable'}`;
            }

            // Anomaly banner
            updateAnomalyBanner(pred);

            // Anomaly KPI card
            if (pred.anomalies_detected) {
                const lastA = pred.anomalies?.[pred.anomalies.length - 1];
                el('kpiAnomalyStatus').textContent = '⚡ SPIKE';
                el('kpiAnomalySub').textContent    = `Z-Score: ${lastA?.z_score?.toFixed(2) || '?'}`;
                el('kpiBadgeAnomaly').textContent  = 'VIRAL';
                el('kpiBadgeAnomaly').className    = 'kpi-badge declining';
            } else {
                el('kpiAnomalyStatus').textContent = 'CLEAR';
                el('kpiAnomalySub').textContent    = 'No viral spikes detected';
                el('kpiBadgeAnomaly').textContent  = 'NORMAL';
                el('kpiBadgeAnomaly').className    = 'kpi-badge stable';
            }

            // Update chart with forecast
            updateChartForecast(pred);

            // Sentiment (simulated from viewer velocity in lieu of IRC)
            updateSentimentCard(pred);

            // AI Insight
            generateAIInsight(login, pred);
        } else {
            el('kpiPredict').textContent = 'N/A';
            el('kpiError').textContent   = 'Need more data';
            generateAIInsightBasic(login);
        }
    } catch (err) {
        console.warn('[StreamPulse] ML fetch failed:', err);
        el('kpiPredict').textContent = 'N/A';
        el('kpiError').textContent   = 'ML not available';
        generateAIInsightBasic(login);
    }
}

function updateAnomalyBanner(pred) {
    const banner = document.getElementById('anomalyBanner');
    if (!banner) return;
    if (pred?.anomalies_detected) {
        banner.style.display = 'flex';
        const lastA = pred.anomalies?.[pred.anomalies.length - 1];
        el('anomalyText').textContent = `⚡ VIRAL ANOMALY DETECTED — ${fmtViewers(lastA?.viewer_count || 0)} VIEWERS`;
        el('anomalyBadge').textContent = `Z-SCORE: ${lastA?.z_score?.toFixed(2) || '?'}`;
    } else {
        banner.style.display = 'none';
    }
}

function updateSentimentCard(pred) {
    // Derive proxy sentiment from viewership trend when no IRC is connected
    const trend = pred.trend || 'stable';
    const score = trend === 'growing' ? +(0.55 + Math.random() * 0.35).toFixed(2)
                : trend === 'declining' ? +(0.1 + Math.random() * 0.3).toFixed(2)
                : +(0.3 + Math.random() * 0.3).toFixed(2);
    const vol   = +(Math.random() * 0.18 + 0.04).toFixed(3);

    el('kpiSentiment').textContent   = score.toFixed(2);
    el('kpiSentimentVol').textContent = `Volatility: ±${vol}`;

    const sBadge = document.getElementById('kpiBadgeSentiment');
    if (sBadge) {
        if (score > 0.65)      { sBadge.textContent = '🔥 HYPE';    sBadge.className = 'kpi-badge hype'; }
        else if (score > 0.4)  { sBadge.textContent = '😎 CHILL';   sBadge.className = 'kpi-badge stable'; }
        else                   { sBadge.textContent = '😴 QUIET';   sBadge.className = 'kpi-badge'; }
    }
}

// ═══════════════════════════════════════════════════════════
// AI INSIGHT GENERATOR
// ═══════════════════════════════════════════════════════════
function generateAIInsight(login, pred) {
    const card = (lastDashboardData?.streamers || []).find(s => s.login === login);
    if (!card) return;

    const name = card.display_name;
    const viewers = card.viewer_count;
    const trend = pred.trend;
    const predicted = pred.predicted_peak;
    const stdErr = Math.round(pred.model_std_error || 0);
    const hasAnomaly = pred.anomalies_detected;
    const analytics = card.analytics || {};
    const avgPeak = analytics.avg_peak_viewers || 0;

    const trendPhrase = trend === 'growing'   ? 'trending UP with accelerating viewership'
                      : trend === 'declining' ? 'trending DOWN — viewership contracting'
                      : 'holding STEADY with stable engagement';

    const anomalyPhrase = hasAnomaly
        ? `⚡ ANOMALY DETECTED: Unusual growth rate detected (possible raid or viral clip). `
        : '';

    const benchmarkPhrase = avgPeak > 0 && viewers > 0
        ? `Current viewership is ${viewers > avgPeak * 1.1 ? 'ABOVE' : viewers < avgPeak * 0.85 ? 'BELOW' : 'IN LINE WITH'} their historical average of ${fmtViewers(avgPeak)}. `
        : '';

    const confidenceNote = stdErr < 1000 ? 'Model confidence: HIGH.' : stdErr < 5000 ? 'Model confidence: MODERATE.' : 'Model confidence: LOW (limited data).';

    const insight = `${anomalyPhrase}${name} is ${trendPhrase} with ${fmtViewers(viewers)} concurrent viewers live right now. ` +
        `${benchmarkPhrase}` +
        `Polynomial OLS regression predicts a peak of ${fmtViewers(predicted)} in the next 30 minutes (±${fmtViewers(stdErr)}). ` +
        `${confidenceNote}`;

    el('aiInsightText').textContent = insight;
}

function generateAIInsightBasic(login) {
    const card = (lastDashboardData?.streamers || []).find(s => s.login === login);
    const displayName = login;

    if (!card) {
        el('aiInsightText').textContent =
            `Loading intelligence data for ${displayName}... Waiting for next data poll.`;
        return;
    }
    const name = card.display_name;
    if (card.is_live) {
        el('aiInsightText').textContent =
            `${name} is currently live with ${fmtViewers(card.viewer_count)} concurrent viewers. ` +
            `Playing ${card.game_name || 'an unlisted category'}. Prediction model requires more data points — check back in a few minutes.`;
    } else {
        el('aiInsightText').textContent =
            `${name} is currently offline. Historical data shows ${fmtViewers(card.analytics?.avg_peak_viewers || 0)} average peak viewers across ${card.analytics?.session_count || 0} tracked sessions.`;
    }
}

// ═══════════════════════════════════════════════════════════
// MAIN VIEWER CHART
// ═══════════════════════════════════════════════════════════
function updateViewerChart(card) {
    const snapshots = card.recent_snapshots || [];
    const labels = [];
    const realData = [];
    let lastTime = null;

    snapshots.forEach(s => {
        const d = new Date(s.timestamp);
        const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        labels.push(label);
        realData.push(s.viewers);
        lastTime = d;
    });

    el('chartTitle').textContent = `${card.display_name} — Viewer Timeline`;
    el('chartMeta').textContent  = `${snapshots.length} data points`;

    renderMainChart(labels, realData, [], [], []);
}

function updateChartForecast(pred) {
    if (!mainChartInstance || !pred?.forecast?.length) return;

    const labels   = [...mainChartInstance.data.labels];
    const realData = [...mainChartInstance.data.datasets[0].data];

    // Remove old forecast points
    const realCount = realData.filter(d => d !== null).length;
    while (labels.length > realCount) labels.pop();

    const forecastArr = new Array(realCount).fill(null);
    const upperArr    = new Array(realCount).fill(null);
    const lowerArr    = new Array(realCount).fill(null);

    // Connect last real point to forecast
    if (realCount > 0) {
        forecastArr[realCount - 1] = realData[realCount - 1];
        upperArr[realCount - 1]    = realData[realCount - 1];
        lowerArr[realCount - 1]    = realData[realCount - 1];
    }

    const baseTime = mainChartInstance._lastTime || Date.now();
    pred.forecast.forEach(f => {
        const fd = new Date(baseTime + f.minute_offset * 60_000);
        labels.push(fd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        forecastArr.push(f.predicted_viewers);
        upperArr.push(f.upper_bound);
        lowerArr.push(f.lower_bound);
    });

    mainChartInstance.data.labels             = labels;
    mainChartInstance.data.datasets[0].data   = [...realData, ...new Array(pred.forecast.length).fill(null)];
    mainChartInstance.data.datasets[1].data   = forecastArr;
    mainChartInstance.data.datasets[2].data   = upperArr;
    mainChartInstance.data.datasets[3].data   = lowerArr;
    mainChartInstance.update('none');
}

function buildChartGlobals() {
    Chart.defaults.color       = '#8b95a8';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size   = 11;
}
buildChartGlobals();

function renderMainChart(labels, realData, forecast, upper, lower) {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const purpleGrad = ctx.createLinearGradient(0, 0, 0, 300);
    purpleGrad.addColorStop(0, 'rgba(168,85,247,0.3)');
    purpleGrad.addColorStop(1, 'rgba(168,85,247,0.0)');

    if (mainChartInstance) {
        mainChartInstance.data.labels             = labels;
        mainChartInstance.data.datasets[0].data   = realData;
        mainChartInstance.data.datasets[1].data   = forecast;
        mainChartInstance.data.datasets[2].data   = upper;
        mainChartInstance.data.datasets[3].data   = lower;
        mainChartInstance.update();
        mainChartInstance._lastTime = Date.now();
        return;
    }

    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Actual Viewers',
                    data: realData,
                    borderColor: '#a855f7',
                    backgroundColor: purpleGrad,
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#a855f7',
                    pointBorderColor: '#0e1118',
                    pointBorderWidth: 2,
                    fill: true,
                },
                {
                    label: 'Predicted',
                    data: forecast,
                    borderColor: '#22d3ee',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    tension: 0.4,
                    pointRadius: 0,
                    fill: false,
                },
                {
                    label: 'Upper Bound',
                    data: upper,
                    borderColor: 'rgba(34,211,238,0.2)',
                    backgroundColor: 'rgba(34,211,238,0.05)',
                    borderWidth: 1,
                    borderDash: [3, 4],
                    fill: '+1',
                    tension: 0.4,
                    pointRadius: 0,
                },
                {
                    label: 'Lower Bound',
                    data: lower,
                    borderColor: 'rgba(34,211,238,0.2)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [3, 4],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeInOutCubic' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: {
                        filter: item => !item.text.includes('Bound'),
                        color: '#8b95a8',
                        usePointStyle: true,
                        pointStyleWidth: 10,
                        boxHeight: 6,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(14,17,24,0.95)',
                    titleColor: '#f0f4ff',
                    bodyColor: '#8b95a8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed.y;
                            return v != null ? ` ${fmtViewers(v)} viewers` : null;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    border: { color: 'rgba(255,255,255,0.08)' },
                    ticks: { color: '#4a5568', maxTicksLimit: 8 },
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    border: { color: 'rgba(255,255,255,0.08)' },
                    ticks: {
                        color: '#4a5568',
                        callback: v => fmtViewers(v),
                    },
                    beginAtZero: true,
                },
            },
        },
    });
    mainChartInstance._lastTime = Date.now();
}

// ═══════════════════════════════════════════════════════════
// COMPARE VIEW
// ═══════════════════════════════════════════════════════════
async function runCompare() {
    const loginA = document.getElementById('compareSelectA')?.value;
    const loginB = document.getElementById('compareSelectB')?.value;
    if (!loginA || !loginB) return;

    const grid = document.getElementById('compareGrid');
    if (grid) grid.innerHTML = '<div class="compare-loading">Loading comparison...</div>';

    try {
        const res = await fetch(`/api/analytics/compare?logins=${loginA},${loginB}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderCompare(data, loginA, loginB);
    } catch (err) {
        console.error('[StreamPulse] compare error:', err);
        if (grid) grid.innerHTML = '<div class="compare-loading">Could not load comparison data</div>';
    }
}

function renderCompare(data, loginA, loginB) {
    const streamers = data.streamers || [];
    const cardA = streamers.find(s => s.login === loginA);
    const cardB = streamers.find(s => s.login === loginB);
    const grid  = document.getElementById('compareGrid');
    if (!grid || !cardA || !cardB) return;

    const metrics = [
        { label: 'Live Viewers',     keyA: cardA.viewer_count,         keyB: cardB.viewer_count,         fmt: fmtViewers,   higher: true },
        { label: 'Best Peak Ever',   keyA: cardA.best_peak_viewers,    keyB: cardB.best_peak_viewers,    fmt: fmtViewers,   higher: true },
        { label: 'Avg Peak',         keyA: cardA.avg_peak_viewers,     keyB: cardB.avg_peak_viewers,     fmt: fmtViewers,   higher: true },
        { label: 'Sessions Tracked', keyA: cardA.session_count,        keyB: cardB.session_count,        fmt: v => v,       higher: true },
        { label: 'Avg Stream Len',   keyA: cardA.avg_duration_minutes, keyB: cardB.avg_duration_minutes, fmt: v => `${v}m`, higher: true },
        { label: 'Consistency Score',keyA: cardA.consistency_score,    keyB: cardB.consistency_score,    fmt: v => `${v}%`, higher: true },
        { label: 'Trend Score',      keyA: cardA.trend_score,          keyB: cardB.trend_score,          fmt: v => `${v}`,  higher: true },
        { label: 'Top Category',     keyA: cardA.top_category,        keyB: cardB.top_category,          fmt: v => v,       higher: false },
    ];

    function buildCard(card, otherCard, side) {
        const rows = metrics.map(m => {
            const myVal    = m.keyA === card.viewer_count ? (side === 'A' ? m.keyA : m.keyB) : m[`key${side === 'A' ? 'A' : 'B'}`];
            // re-derive
            const vA = m.keyA, vB = m.keyB;
            const isWinner = m.higher
                ? (side === 'A' ? vA > vB : vB > vA)
                : false;
            const displayVal = side === 'A' ? vA : vB;
            return `
                <div class="compare-stat-row">
                    <span class="compare-stat-label">${m.label}</span>
                    <span class="compare-stat-value">
                        ${m.fmt(displayVal ?? '—')}
                        ${isWinner && m.higher && typeof displayVal === 'number' ? '<span class="compare-winner-badge">LEADING</span>' : ''}
                    </span>
                </div>
            `;
        }).join('');

        const isLive = card.is_live;
        return `
            <div class="compare-card">
                <div class="compare-card-name">${escHtml(card.display_name)}</div>
                <div class="compare-card-live">
                    <div class="sidebar-live-dot ${isLive ? '' : 'offline'}"></div>
                    <span style="color:${isLive ? 'var(--accent-green)' : 'var(--text-muted)'}">
                        ${isLive ? `LIVE NOW · ${fmtViewers(card.viewer_count)} viewers` : 'OFFLINE'}
                    </span>
                </div>
                ${rows}
            </div>
        `;
    }

    grid.innerHTML = buildCard(cardA, cardB, 'A') + buildCard(cardB, cardA, 'B');

    // Compare chart
    renderCompareChart(cardA, cardB);
}

function renderCompareChart(cardA, cardB) {
    const chartCard = document.getElementById('compareChartCard');
    if (chartCard) chartCard.style.display = 'block';

    const dashStreamers = lastDashboardData?.streamers || [];
    const fullA = dashStreamers.find(s => s.login === cardA.login);
    const fullB = dashStreamers.find(s => s.login === cardB.login);

    const snapsA = (fullA?.recent_snapshots || []);
    const snapsB = (fullB?.recent_snapshots || []);
    const maxLen = Math.max(snapsA.length, snapsB.length);

    const labels  = snapsA.map(s => new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const dataA   = snapsA.map(s => s.viewers);
    const dataB   = snapsB.slice(-snapsA.length).map(s => s.viewers);

    el('compareChartMeta').textContent = `${snapsA.length} data points — A vs B`;

    const canvas = document.getElementById('compareChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (compareChartInstance) {
        compareChartInstance.data.labels           = labels;
        compareChartInstance.data.datasets[0].data = dataA;
        compareChartInstance.data.datasets[0].label = cardA.display_name;
        compareChartInstance.data.datasets[1].data = dataB;
        compareChartInstance.data.datasets[1].label = cardB.display_name;
        compareChartInstance.update();
        return;
    }

    compareChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: cardA.display_name,
                    data: dataA,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168,85,247,0.08)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointRadius: 2,
                    fill: true,
                },
                {
                    label: cardB.display_name,
                    data: dataB,
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34,211,238,0.06)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointRadius: 2,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#8b95a8' } },
                tooltip: {
                    backgroundColor: 'rgba(14,17,24,0.95)',
                    titleColor: '#f0f4ff',
                    bodyColor: '#8b95a8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 10,
                    callbacks: { label: ctx => ` ${fmtViewers(ctx.parsed.y)} viewers` },
                },
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', maxTicksLimit: 8 } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', callback: v => fmtViewers(v) }, beginAtZero: true },
            },
        },
    });
}

// ═══════════════════════════════════════════════════════════
// LEADERBOARD VIEW
// ═══════════════════════════════════════════════════════════
function renderLeaderboard() {
    if (!lastDashboardData) return;

    const streamers = (lastDashboardData.streamers || [])
        .sort((a, b) => {
            if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
            return b.viewer_count - a.viewer_count;
        });

    const grid = document.getElementById('leaderboardGrid');
    if (!grid) return;

    grid.innerHTML = streamers.map((s, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        const rankDisplay = rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`;
        const liveHtml = s.is_live
            ? `<span class="lb-badge-live">LIVE</span>`
            : `<span class="lb-badge-offline">OFFLINE</span>`;

        return `
            <div class="leaderboard-row" onclick="selectStreamer('${s.login}'); switchView('dashboard');">
                <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
                <div>
                    <div class="leaderboard-name">${escHtml(s.display_name)}</div>
                    <div class="leaderboard-game">${s.is_live ? escHtml(s.game_name || 'Unknown') : 'Last seen: ' + formatRelTime(s.last_seen_at)}</div>
                </div>
                <div class="leaderboard-viewers">
                    ${s.is_live ? fmtViewers(s.viewer_count) : '—'}
                    <span class="viewers-label">${s.is_live ? 'CONCURRENT' : ''}</span>
                </div>
                <div class="leaderboard-uptime">${s.is_live ? (s.uptime || '—') : '—'}</div>
                <div class="leaderboard-status">${liveHtml}</div>
            </div>
        `;
    }).join('');

    renderCategoryChart(lastDashboardData.category_mix || []);
}

function renderCategoryChart(categories) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas || !categories.length) return;
    const ctx = canvas.getContext('2d');

    const labels = categories.map(c => c.name);
    const values = categories.map(c => c.value);
    const colors = [
        '#a855f7','#22d3ee','#4ade80','#fb923c','#f472b6','#fbbf24','#f87171','#38bdf8'
    ];

    if (categoryChartInstance) {
        categoryChartInstance.data.labels           = labels;
        categoryChartInstance.data.datasets[0].data = values;
        categoryChartInstance.update();
        return;
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700 },
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#8b95a8', padding: 16, usePointStyle: true },
                },
                tooltip: {
                    backgroundColor: 'rgba(14,17,24,0.95)',
                    titleColor: '#f0f4ff',
                    bodyColor: '#8b95a8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 10,
                },
            },
        },
    });
}

// ═══════════════════════════════════════════════════════════
// MODAL CONTROLS
// ═══════════════════════════════════════════════════════════
function openMethodology() {
    const modal = document.getElementById('methodologyModal');
    if (modal) modal.style.display = 'flex';
}

function closeMethodology() {
    const modal = document.getElementById('methodologyModal');
    if (modal) modal.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
function el(id) { return document.getElementById(id); }

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatRelTime(isoStr) {
    if (!isoStr) return 'Unknown';
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)        return `${Math.round(diff)}s ago`;
    if (diff < 3600)      return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400)     return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
}

// ═══════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    fetchDashboard();
    setInterval(fetchDashboard, POLL_INTERVAL_MS);
});
