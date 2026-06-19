// ============================================================
// Buzz Finder — scanner de vidéos YouTube en forte croissance
// Appelle directement l'API YouTube Data v3 depuis le navigateur.
// Aucun backend nécessaire : tout tourne côté client.
// ============================================================

const els = {
  settingsToggle: document.getElementById('settings-toggle'),
  settingsPanel: document.getElementById('settings-panel'),
  apiKeyInput: document.getElementById('api-key'),
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
  query: 'buzzfinder.lastQuery',
};

// ---- Init: restore saved settings ----
(function restore() {
  const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (savedKey) els.apiKeyInput.value = savedKey;
  else els.settingsPanel.hidden = false;

  const savedQuery = localStorage.getItem(STORAGE_KEYS.query);
  if (savedQuery) els.query.value = savedQuery;
})();

els.settingsToggle.addEventListener('click', () => {
  const isHidden = els.settingsPanel.hidden;
  els.settingsPanel.hidden = !isHidden;
  els.settingsToggle.setAttribute('aria-expanded', String(isHidden));
});

els.apiKeyInput.addEventListener('change', () => {
  localStorage.setItem(STORAGE_KEYS.apiKey, els.apiKeyInput.value.trim());
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

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function setStatus(message, kind) {
  els.status.textContent = message || '';
  els.status.className = 'status' + (kind ? ' is-' + kind : '');
}

// ---- YouTube API calls ----

async function searchCandidateVideos({ apiKey, query, region, maxResults = 25 }) {
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
    throw new Error(err?.error?.message || `Erreur API (recherche) : ${searchRes.status}`);
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
    throw new Error(err?.error?.message || `Erreur API (détails) : ${videosRes.status}`);
  }
  const videosData = await videosRes.json();
  return videosData.items || [];
}

function computeBuzzScore(video) {
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

  const buzzScore = viewsPerHour * (1 + engagementRate * 5);

  return {
    id: video.id,
    title: snippet.title,
    channel: snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    views,
    likes,
    comments,
    durationSeconds,
    durationMin: Math.round((durationSeconds / 60) * 10) / 10,
    hoursSincePublished: Math.round(hoursElapsed * 10) / 10,
    viewsPerHour,
    engagementRatePct: Math.round(engagementRate * 1000) / 10,
    buzzScore,
  };
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

    const fillPct = Math.max(6, Math.round((v.buzzScore / maxScore) * 100));
    node.querySelector('.meter-fill').style.width = fillPct + '%';

    node.querySelector('.stat-views').textContent = formatNumber(v.views);
    node.querySelector('.stat-velocity').textContent = formatNumber(v.viewsPerHour) + '/h';
    node.querySelector('.stat-duration').textContent = v.durationMin + ' min';
    node.querySelector('.stat-engagement').textContent = v.engagementRatePct + '%';

    const link = node.querySelector('.card-link');
    link.href = v.url;

    els.results.appendChild(node);
  });
}

// ---- Main scan action ----

async function runScan() {
  const apiKey = els.apiKeyInput.value.trim();
  const query = els.query.value.trim();
  const region = els.region.value;
  const minDuration = parseInt(els.minDuration.value, 10);

  if (!apiKey) {
    els.settingsPanel.hidden = false;
    els.settingsToggle.setAttribute('aria-expanded', 'true');
    setStatus('Ajoute ta clé API YouTube avant de scanner.', 'error');
    els.apiKeyInput.focus();
    return;
  }
  if (!query) {
    setStatus('Indique un sujet ou un mot-clé.', 'error');
    els.query.focus();
    return;
  }

  localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
  localStorage.setItem(STORAGE_KEYS.query, query);

  els.scanBtn.disabled = true;
  els.scanBtn.classList.add('is-loading');
  els.results.innerHTML = '';
  setStatus(`Scan en cours pour « ${query} »…`);

  try {
    const raw = await searchCandidateVideos({ apiKey, query, region, maxResults: 25 });
    const scored = raw.map(computeBuzzScore);
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
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* silent fail: app still works without offline shell */
    });
  });
}
