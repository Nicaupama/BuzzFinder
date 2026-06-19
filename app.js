// ============================================================
// Buzz Finder — scanner de vidéos YouTube + Twitch en forte croissance
// Tout tourne côté client : aucun backend nécessaire.
// ============================================================

const els = {
  settingsToggle: document.getElementById('settings-toggle'),
  settingsPanel: document.getElementById('settings-panel'),
  apiKeyInput: document.getElementById('api-key'),
  ytSaveState: document.getElementById('yt-save-state'),
  twitchClientId: document.getElementById('twitch-client-id'),
  twitchClientSecret: document.getElementById('twitch-client-secret'),
  twitchSaveState: document.getElementById('twitch-save-state'),
  sourceTabs: document.querySelectorAll('.source-tab'),
  queryField: document.getElementById('query-field'),
  queryLabel: document.getElementById('query-label'),
  twitchQueryHint: document.getElementById('twitch-query-hint'),
  regionRow: document.getElementById('region-row'),
  query: document.getElementById('query'),
  region: document.getElementById('region'),
  minDuration: document.getElementById('min-duration'),
  scanBtn: document.getElementById('scan-btn'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
  cardTpl: document.getElementById('result-card-tpl'),
};

const STORAGE_KEYS = {
  apiKey: 'buzzfinder.apiKey',
  twitchClientId: 'buzzfinder.twitchClientId',
  twitchClientSecret: 'buzzfinder.twitchClientSecret',
  query: 'buzzfinder.lastQuery',
  source: 'buzzfinder.lastSource',
};

let currentSource = 'youtube';
let twitchTokenCache = null; // { token, expiresAt }

// ---- Init: restore saved settings ----
(function restore() {
  const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (savedKey) {
    els.apiKeyInput.value = savedKey;
    flashSaveState(els.ytSaveState, 'Clé YouTube en mémoire ✓');
  }

  const savedClientId = localStorage.getItem(STORAGE_KEYS.twitchClientId);
  const savedClientSecret = localStorage.getItem(STORAGE_KEYS.twitchClientSecret);
  if (savedClientId) els.twitchClientId.value = savedClientId;
  if (savedClientSecret) els.twitchClientSecret.value = savedClientSecret;
  if (savedClientId && savedClientSecret) {
    flashSaveState(els.twitchSaveState, 'Identifiants Twitch en mémoire ✓');
  }

  const savedQuery = localStorage.getItem(STORAGE_KEYS.query);
  if (savedQuery) els.query.value = savedQuery;

  const savedSource = localStorage.getItem(STORAGE_KEYS.source);
  if (savedSource === 'twitch') setSource('twitch');

  if (!savedKey) els.settingsPanel.hidden = false;
})();

function flashSaveState(node, message) {
  node.textContent = message;
  node.classList.add('is-visible');
}

els.settingsToggle.addEventListener('click', () => {
  const isHidden = els.settingsPanel.hidden;
  els.settingsPanel.hidden = !isHidden;
  els.settingsToggle.setAttribute('aria-expanded', String(isHidden));
});

els.apiKeyInput.addEventListener('change', () => {
  const val = els.apiKeyInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.apiKey, val);
  flashSaveState(els.ytSaveState, val ? 'Clé YouTube sauvegardée ✓' : '');
});

[els.twitchClientId, els.twitchClientSecret].forEach((input) => {
  input.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEYS.twitchClientId, els.twitchClientId.value.trim());
    localStorage.setItem(STORAGE_KEYS.twitchClientSecret, els.twitchClientSecret.value.trim());
    twitchTokenCache = null; // invalidate cached token if credentials change
    const hasBoth = els.twitchClientId.value.trim() && els.twitchClientSecret.value.trim();
    flashSaveState(els.twitchSaveState, hasBoth ? 'Identifiants Twitch sauvegardés ✓' : '');
  });
});

// ---- Source switching ----

function setSource(source) {
  currentSource = source;
  localStorage.setItem(STORAGE_KEYS.source, source);

  els.sourceTabs.forEach((tab) => {
    const active = tab.dataset.source === source;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  if (source === 'twitch') {
    els.queryLabel.textContent = 'Jeu / catégorie';
    els.query.placeholder = 'ex : League of Legends, Just Chatting…';
    els.twitchQueryHint.hidden = false;
    els.regionRow.querySelector('label').style.display = 'none'; // region not used by Twitch
  } else {
    els.queryLabel.textContent = 'Sujet / mot-clé';
    els.query.placeholder = 'ex : gaming clutch, interview, vulgarisation…';
    els.twitchQueryHint.hidden = true;
    els.regionRow.querySelector('label').style.display = '';
  }

  els.results.innerHTML = '';
  setStatus('');
}

els.sourceTabs.forEach((tab) => {
  tab.addEventListener('click', () => setSource(tab.dataset.source));
});

// ---- Helpers ----

function parseISO8601Duration(duration) {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(duration || '');
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Twitch durations look like "3h21m10s", "45m10s", or "32s"
function parseTwitchDuration(duration) {
  const match = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(duration || '');
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function setStatus(message, kind) {
  els.status.textContent = message || '';
  els.status.className = 'status' + (kind ? ' is-' + kind : '');
}

// ---- YouTube ----

async function searchYouTube({ apiKey, query, region, maxResults = 25 }) {
  const publishedAfter = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('.')[0] + 'Z';

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.search = new URLSearchParams({
    q: query,
    part: 'id',
    type: 'video',
    order: 'viewCount',
    regionCode: region,
    maxResults: String(Math.min(maxResults, 50)),
    publishedAfter,
    key: apiKey,
  }).toString();

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erreur API YouTube (recherche) : ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const videoIds = (searchData.items || []).map((item) => item.id.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.search = new URLSearchParams({
    id: videoIds.join(','),
    part: 'snippet,statistics,contentDetails',
    key: apiKey,
  }).toString();

  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) {
    const err = await videosRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erreur API YouTube (détails) : ${videosRes.status}`);
  }
  const videosData = await videosRes.json();

  return (videosData.items || []).map((video) => {
    const stats = video.statistics || {};
    const snippet = video.snippet || {};
    const content = video.contentDetails || {};

    const views = parseInt(stats.viewCount || '0', 10);
    const likes = parseInt(stats.likeCount || '0', 10);
    const comments = parseInt(stats.commentCount || '0', 10);
    const publishedAt = new Date(snippet.publishedAt);
    const hoursElapsed = Math.max((Date.now() - publishedAt.getTime()) / 3_600_000, 1);
    const viewsPerHour = views / hoursElapsed;
    const engagementRate = views > 0 ? (likes + comments) / views : 0;
    const durationSeconds = parseISO8601Duration(content.duration);

    return {
      platform: 'youtube',
      id: video.id,
      title: snippet.title,
      channel: snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      views,
      durationSeconds,
      durationMin: Math.round((durationSeconds / 60) * 10) / 10,
      viewsPerHour,
      engagementRatePct: Math.round(engagementRate * 1000) / 10,
      buzzScore: viewsPerHour * (1 + engagementRate * 5),
    };
  });
}

// ---- Twitch ----

async function getTwitchToken(clientId, clientSecret) {
  if (twitchTokenCache && twitchTokenCache.expiresAt > Date.now()) {
    return twitchTokenCache.token;
  }
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.search = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  }).toString();

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Erreur d'authentification Twitch : ${res.status}. Vérifie ton Client ID / Secret.`);
  }
  const data = await res.json();
  twitchTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return twitchTokenCache.token;
}

async function searchTwitch({ clientId, clientSecret, query, maxResults = 25 }) {
  const token = await getTwitchToken(clientId, clientSecret);
  const headers = { 'Client-Id': clientId, Authorization: `Bearer ${token}` };

  // Step 1: resolve game/category name -> id
  const gameUrl = new URL('https://api.twitch.tv/helix/games');
  gameUrl.search = new URLSearchParams({ name: query }).toString();
  const gameRes = await fetch(gameUrl, { headers });
  if (!gameRes.ok) throw new Error(`Erreur API Twitch (jeu) : ${gameRes.status}`);
  const gameData = await gameRes.json();
  const game = (gameData.data || [])[0];
  if (!game) throw new Error(`Aucun jeu/catégorie Twitch trouvé pour « ${query} ». Vérifie l'orthographe exacte.`);

  // Step 2: fetch top VODs (archives) for that game, sorted by views over the last week
  const videosUrl = new URL('https://api.twitch.tv/helix/videos');
  videosUrl.search = new URLSearchParams({
    game_id: game.id,
    period: 'week',
    sort: 'views',
    type: 'archive',
    first: String(Math.min(maxResults, 100)),
  }).toString();
  const videosRes = await fetch(videosUrl, { headers });
  if (!videosRes.ok) throw new Error(`Erreur API Twitch (vidéos) : ${videosRes.status}`);
  const videosData = await videosRes.json();

  return (videosData.data || []).map((v) => {
    const views = v.view_count || 0;
    const createdAt = new Date(v.created_at);
    const hoursElapsed = Math.max((Date.now() - createdAt.getTime()) / 3_600_000, 1);
    const viewsPerHour = views / hoursElapsed;
    const durationSeconds = parseTwitchDuration(v.duration);

    return {
      platform: 'twitch',
      id: v.id,
      title: v.title,
      channel: v.user_name,
      url: v.url,
      views,
      durationSeconds,
      durationMin: Math.round((durationSeconds / 60) * 10) / 10,
      viewsPerHour,
      engagementRatePct: null, // Twitch API doesn't expose likes/comments on VODs
      buzzScore: viewsPerHour,
    };
  });
}

// ---- Rendering ----

function renderResults(videos) {
  els.results.innerHTML = '';
  if (videos.length === 0) return;

  const maxScore = Math.max(...videos.map((v) => v.buzzScore), 1);

  videos.forEach((v, index) => {
    const node = els.cardTpl.content.cloneNode(true);
    const card = node.querySelector('.card');
    card.style.animationDelay = `${index * 45}ms`;

    node.querySelector('.card-rank').textContent = String(index + 1).padStart(2, '0');
    node.querySelector('.card-title').textContent = v.title;
    node.querySelector('.card-channel').textContent = v.channel;

    const badge = node.querySelector('.platform-badge');
    badge.textContent = v.platform === 'twitch' ? 'Twitch' : 'YouTube';
    badge.classList.add(v.platform);

    const fillPct = Math.max(6, Math.round((v.buzzScore / maxScore) * 100));
    node.querySelector('.meter-fill').style.width = fillPct + '%';

    node.querySelector('.stat-views').textContent = formatNumber(v.views);
    node.querySelector('.stat-velocity').textContent = formatNumber(v.viewsPerHour) + '/h';
    node.querySelector('.stat-duration').textContent = v.durationMin + ' min';
    node.querySelector('.stat-engagement').textContent =
      v.engagementRatePct === null ? '—' : v.engagementRatePct + '%';

    const link = node.querySelector('.card-link');
    link.href = v.url;

    els.results.appendChild(node);
  });
}

// ---- Main scan action ----

async function runScan() {
  const query = els.query.value.trim();
  const minDuration = parseInt(els.minDuration.value, 10);

  if (!query) {
    setStatus(currentSource === 'twitch' ? 'Indique un jeu ou une catégorie.' : 'Indique un sujet ou un mot-clé.', 'error');
    els.query.focus();
    return;
  }

  localStorage.setItem(STORAGE_KEYS.query, query);

  els.scanBtn.disabled = true;
  els.scanBtn.classList.add('is-loading');
  els.results.innerHTML = '';
  setStatus(`Scan en cours pour « ${query} »…`);

  try {
    let scored;

    if (currentSource === 'youtube') {
      const apiKey = els.apiKeyInput.value.trim();
      if (!apiKey) {
        els.settingsPanel.hidden = false;
        els.settingsToggle.setAttribute('aria-expanded', 'true');
        throw new Error('Ajoute ta clé API YouTube avant de scanner.');
      }
      scored = await searchYouTube({ apiKey, query, region: els.region.value, maxResults: 25 });
    } else {
      const clientId = els.twitchClientId.value.trim();
      const clientSecret = els.twitchClientSecret.value.trim();
      if (!clientId || !clientSecret) {
        els.settingsPanel.hidden = false;
        els.settingsToggle.setAttribute('aria-expanded', 'true');
        throw new Error('Ajoute ton Client ID et Client Secret Twitch avant de scanner.');
      }
      scored = await searchTwitch({ clientId, clientSecret, query, maxResults: 25 });
    }

    const clippable = scored.filter((v) => v.durationSeconds >= minDuration);
    clippable.sort((a, b) => b.buzzScore - a.buzzScore);

    if (clippable.length === 0) {
      setStatus('Aucune vidéo assez longue trouvée. Essaie une durée min. plus courte ou un autre mot-clé.', 'empty');
    } else {
      setStatus(`${clippable.length} vidéo(s) candidate(s), triée(s) par intensité de buzz.`);
      renderResults(clippable.slice(0, 10));
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Une erreur est survenue.', 'error');
  } finally {
    els.scanBtn.disabled = false;
    els.scanBtn.classList.remove('is-loading');
  }
}

els.scanBtn.addEventListener('click', runScan);
els.query.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runScan();
});

// ---- PWA service worker registration ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
