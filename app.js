// ============================================================
// Buzz Finder — scanner YouTube + Twitch, détection de replays,
// générateur de hashtags. Tout tourne côté client.
// ============================================================

const els = {
  settingsToggle: document.getElementById('settings-toggle'),
  settingsPanel: document.getElementById('settings-panel'),
  apiKeyInput: document.getElementById('api-key'),
  ytSaveState: document.getElementById('yt-save-state'),
  twitchClientId: document.getElementById('twitch-client-id'),
  twitchClientSecret: document.getElementById('twitch-client-secret'),
  twitchSaveState: document.getElementById('twitch-save-state'),

  viewEyebrow: document.getElementById('view-eyebrow'),
  viewTitle: document.getElementById('view-title'),
  railBtns: document.querySelectorAll('.rail-btn[data-view]'),
  views: document.querySelectorAll('.view'),

  sourceTabs: document.querySelectorAll('.source-tab'),
  queryLabel: document.getElementById('query-label'),
  twitchQueryHint: document.getElementById('twitch-query-hint'),
  regionRow: document.getElementById('region-row'),
  query: document.getElementById('query'),
  region: document.getElementById('region'),
  minDuration: document.getElementById('min-duration'),
  typeFilter: document.getElementById('type-filter'),
  scanBtn: document.getElementById('scan-btn'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
  cardTpl: document.getElementById('result-card-tpl'),

  ideasNiche: document.getElementById('ideas-niche'),
  ideasPlatform: document.getElementById('ideas-platform'),
  ideasHistory: document.getElementById('ideas-history'),
  ideasFeedback: document.getElementById('ideas-feedback'),
  ideasApiKey: document.getElementById('ideas-api-key'),
  ideasKeyState: document.getElementById('ideas-key-state'),
  ideasBtn: document.getElementById('ideas-btn'),
  ideasOutput: document.getElementById('ideas-output'),

  hashtagTitle: document.getElementById('hashtag-title'),
  hashtagChannel: document.getElementById('hashtag-channel'),
  hashtagPlatform: document.getElementById('hashtag-platform'),
  hashtagBtn: document.getElementById('hashtag-btn'),
  hashtagOutputWrap: document.getElementById('hashtag-output-wrap'),
  hashtagPills: document.getElementById('hashtag-pills'),
  copyHashtagsBtn: document.getElementById('copy-hashtags-btn'),
  copyConfirm: document.getElementById('copy-confirm'),
};

const STORAGE_KEYS = {
  apiKey: 'buzzfinder.apiKey',
  twitchClientId: 'buzzfinder.twitchClientId',
  twitchClientSecret: 'buzzfinder.twitchClientSecret',
  query: 'buzzfinder.lastQuery',
  source: 'buzzfinder.lastSource',
};

const VIEW_LABELS = {
  scan: { eyebrow: 'Scanner en direct', title: 'Buzz Finder' },
  ideas: { eyebrow: 'Inspiré par ton profil', title: 'Mes Idées' },
  hashtags: { eyebrow: 'Booster ta portée', title: 'Hashtags' },
};

let currentSource = 'youtube';
let twitchTokenCache = null; // { token, expiresAt }
let lastResults = []; // garde les derniers résultats pour le bouton "# Hashtags" des cartes

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

  const savedIdeasKey = localStorage.getItem('buzzfinder.anthropicKey');
  if (savedIdeasKey) {
    els.ideasApiKey.value = savedIdeasKey;
    flashSaveState(els.ideasKeyState, 'Clé Anthropic en mémoire ✓');
  }

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
    twitchTokenCache = null;
    const hasBoth = els.twitchClientId.value.trim() && els.twitchClientSecret.value.trim();
    flashSaveState(els.twitchSaveState, hasBoth ? 'Identifiants Twitch sauvegardés ✓' : '');
  });
});

// ---- Navigation entre vues (rail de droite) ----

function setView(view) {
  els.railBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  });
  els.views.forEach((section) => {
    section.classList.toggle('is-active', section.id === `view-${view}`);
  });
  const labels = VIEW_LABELS[view];
  if (labels) {
    els.viewEyebrow.textContent = labels.eyebrow;
    els.viewTitle.textContent = labels.title;
  }
}

els.railBtns.forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

// ---- Source switching (YouTube / Twitch) ----

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
    els.regionRow.querySelector('label').style.display = 'none';
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

// ---- Catégories rapides ----

const CATEGORY_PRESETS = {
  youtube: {
    gaming: 'gaming highlights montage',
    esport: 'esport tournament highlights',
    incredible: 'incredible moment caught on camera',
    bigproject: 'mega projet construction documentaire',
  },
  twitch: {
    gaming: 'Just Chatting',
    esport: 'Esports',
    incredible: 'Special Events',
    bigproject: 'Science & Technology',
  },
};

const categoryChips = document.querySelectorAll('.chip[data-category]');
categoryChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    categoryChips.forEach((c) => c.classList.toggle('is-active', c === chip));
    const preset = CATEGORY_PRESETS[currentSource][chip.dataset.category];
    els.query.value = preset;
    runScan();
  });
});

// Si l'utilisateur tape manuellement, on désactive l'état actif des puces
els.query.addEventListener('input', () => {
  categoryChips.forEach((c) => c.classList.remove('is-active'));
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

  // part inclut liveStreamingDetails pour détecter les replays de live
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.search = new URLSearchParams({
    id: videoIds.join(','),
    part: 'snippet,statistics,contentDetails,liveStreamingDetails',
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
    const live = video.liveStreamingDetails;

    const views = parseInt(stats.viewCount || '0', 10);
    const likes = parseInt(stats.likeCount || '0', 10);
    const comments = parseInt(stats.commentCount || '0', 10);
    const publishedAt = new Date(snippet.publishedAt);
    const hoursElapsed = Math.max((Date.now() - publishedAt.getTime()) / 3_600_000, 1);
    const viewsPerHour = views / hoursElapsed;
    const engagementRate = views > 0 ? (likes + comments) / views : 0;
    const durationSeconds = parseISO8601Duration(content.duration);

    // Replay = livestream qui s'est terminé (actualEndTime présent)
    const isReplay = Boolean(live && live.actualEndTime);

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
      isReplay,
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

  const gameUrl = new URL('https://api.twitch.tv/helix/games');
  gameUrl.search = new URLSearchParams({ name: query }).toString();
  const gameRes = await fetch(gameUrl, { headers });
  if (!gameRes.ok) throw new Error(`Erreur API Twitch (jeu) : ${gameRes.status}`);
  const gameData = await gameRes.json();
  const game = (gameData.data || [])[0];
  if (!game) throw new Error(`Aucun jeu/catégorie Twitch trouvé pour « ${query} ». Vérifie l'orthographe exacte.`);

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

  // Toutes les vidéos de type "archive" sont par nature des rediffusions de live
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
      engagementRatePct: null,
      buzzScore: viewsPerHour,
      isReplay: true,
    };
  });
}

// ---- Rendering résultats ----

function renderResults(videos) {
  els.results.innerHTML = '';
  if (videos.length === 0) return;

  const maxScore = Math.max(...videos.map((v) => v.buzzScore), 1);

  videos.forEach((v, index) => {
    const node = els.cardTpl.content.cloneNode(true);
    const card = node.querySelector('.card');
    card.style.animationDelay = `${index * 45}ms`;
    if (v.isReplay) card.classList.add('is-replay');

    node.querySelector('.card-rank').textContent = String(index + 1).padStart(2, '0');
    node.querySelector('.card-title').textContent = v.title;
    node.querySelector('.card-channel').textContent = v.channel;

    const badge = node.querySelector('.platform-badge');
    badge.textContent = v.platform === 'twitch' ? 'Twitch' : 'YouTube';
    badge.classList.add(v.platform);

    const replayBadge = node.querySelector('.replay-badge');
    replayBadge.hidden = !v.isReplay;

    const fillPct = Math.max(6, Math.round((v.buzzScore / maxScore) * 100));
    node.querySelector('.meter-fill').style.width = fillPct + '%';

    node.querySelector('.stat-views').textContent = formatNumber(v.views);
    node.querySelector('.stat-velocity').textContent = formatNumber(v.viewsPerHour) + '/h';
    node.querySelector('.stat-duration').textContent = v.durationMin + ' min';
    node.querySelector('.stat-engagement').textContent =
      v.engagementRatePct === null ? '—' : v.engagementRatePct + '%';

    const link = node.querySelector('.card-link');
    link.href = v.url;

    const hashtagBtn = node.querySelector('.card-hashtag-btn');
    hashtagBtn.addEventListener('click', () => {
      els.hashtagTitle.value = v.title;
      els.hashtagChannel.value = v.channel;
      els.hashtagPlatform.value = v.platform === 'twitch' ? 'all' : 'shorts';
      setView('hashtags');
      generateHashtags();
    });

    els.results.appendChild(node);
  });
}

// ---- Scan principal ----

async function runScan() {
  const query = els.query.value.trim();
  const minDuration = parseInt(els.minDuration.value, 10);
  const typeFilterValue = els.typeFilter.value; // all | video | replay

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

    let filtered = scored.filter((v) => v.durationSeconds >= minDuration);

    if (typeFilterValue === 'video') filtered = filtered.filter((v) => !v.isReplay);
    if (typeFilterValue === 'replay') filtered = filtered.filter((v) => v.isReplay);

    filtered.sort((a, b) => b.buzzScore - a.buzzScore);
    lastResults = filtered;

    if (filtered.length === 0) {
      setStatus('Aucune vidéo ne correspond à ces critères. Essaie une durée ou un filtre différent.', 'empty');
    } else {
      const replayCount = filtered.filter((v) => v.isReplay).length;
      const replayNote = replayCount > 0 ? ` (dont ${replayCount} replay${replayCount > 1 ? 's' : ''})` : '';
      setStatus(`${filtered.length} vidéo(s) candidate(s)${replayNote}, triée(s) par intensité de buzz.`);
      renderResults(filtered.slice(0, 10));
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

// ============================================================
// Générateur de hashtags
// ============================================================

const STOPWORDS = new Set([
  'le','la','les','un','une','des','de','du','et','à','au','aux','en','sur','dans','pour','par',
  'avec','sans','ce','cet','cette','ces','son','sa','ses','qui','que','quoi','est','sont','plus',
  'the','a','an','of','in','on','at','to','for','with','and','or','is','are','this','that',
  'tu','je','il','elle','on','nous','vous','ils','elles','pas','mais','ou','où','quand',
]);

const PLATFORM_TAGS = {
  tiktok: ['#fyp', '#pourtoi', '#viral', '#tiktok', '#trend'],
  shorts: ['#shorts', '#youtubeshorts', '#viral', '#trending'],
  reels: ['#reels', '#reelsinstagram', '#viral', '#explorepage'],
  all: ['#viral', '#fyp', '#shorts', '#reels', '#trending'],
};

function slugifyHashtag(word) {
  return word
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-zA-Z0-9]/g, '');
}

function extractKeywordsFromTitle(title) {
  if (!title) return [];
  const words = title
    .split(/[\s\-–—|:•,!?()[\]"']+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const keywords = [];
  for (const w of words) {
    const clean = slugifyHashtag(w);
    if (clean.length < 3) continue;
    if (STOPWORDS.has(w.toLowerCase())) continue;
    if (keywords.includes(clean.toLowerCase())) continue;
    keywords.push(clean);
    if (keywords.length >= 6) break;
  }
  return keywords;
}

function generateHashtags() {
  const title = els.hashtagTitle.value.trim();
  const channel = els.hashtagChannel.value.trim();
  const platform = els.hashtagPlatform.value;

  if (!title) {
    els.hashtagOutputWrap.hidden = true;
    return;
  }

  const tags = [];

  // 1. Mots-clés tirés du titre
  for (const kw of extractKeywordsFromTitle(title)) {
    tags.push('#' + kw);
  }

  // 2. Tag de la chaîne / créateur
  if (channel) {
    const channelTag = slugifyHashtag(channel);
    if (channelTag.length >= 3) tags.push('#' + channelTag);
  }

  // 3. Tags génériques liés à la plateforme cible
  for (const t of PLATFORM_TAGS[platform] || PLATFORM_TAGS.all) {
    if (!tags.includes(t)) tags.push(t);
  }

  // 4. Tag "clip"/"edit" toujours pertinent pour ce type de contenu
  ['#clip', '#edit', '#highlights'].forEach((t) => {
    if (!tags.includes(t) && tags.length < 15) tags.push(t);
  });

  renderHashtags(tags.slice(0, 15));
}

function renderHashtags(tags) {
  els.hashtagPills.innerHTML = '';
  tags.forEach((tag) => {
    const pill = document.createElement('span');
    pill.className = 'hashtag-pill';
    pill.textContent = tag;
    els.hashtagPills.appendChild(pill);
  });
  els.hashtagOutputWrap.hidden = false;
  els.copyConfirm.textContent = '';
  els.copyConfirm.classList.remove('is-visible');
}

els.hashtagBtn.addEventListener('click', generateHashtags);
els.hashtagTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generateHashtags();
});

els.copyHashtagsBtn.addEventListener('click', async () => {
  const tags = Array.from(els.hashtagPills.querySelectorAll('.hashtag-pill')).map((el) => el.textContent);
  const text = tags.join(' ');
  try {
    await navigator.clipboard.writeText(text);
    els.copyConfirm.textContent = 'Copié dans le presse-papiers ✓';
    els.copyConfirm.classList.add('is-visible');
  } catch {
    els.copyConfirm.textContent = 'Impossible de copier automatiquement — sélectionne le texte manuellement.';
    els.copyConfirm.classList.remove('is-visible');
  }
});

// ============================================================
// VUE IDÉES — Conseils personnalisés via Claude
// ============================================================

// Sync clé Anthropic depuis settings → champ dédié idées (même clé)
const ANTHROPIC_KEY_STORAGE = 'buzzfinder.anthropicKey';

function getAnthropicKey() {
  return (
    els.anthropicKeyInput?.value?.trim() ||
    els.ideasApiKey?.value?.trim() ||
    localStorage.getItem(ANTHROPIC_KEY_STORAGE) ||
    ''
  );
}

// Attache les champs de clé Anthropic (settings panel + champ dédié idées)
const anthropicInputs = [
  document.getElementById('anthropic-key'),
  document.getElementById('ideas-api-key'),
];
anthropicInputs.forEach((input) => {
  if (!input) return;
  const saved = localStorage.getItem(ANTHROPIC_KEY_STORAGE);
  if (saved) input.value = saved;
  input.addEventListener('change', () => {
    const val = input.value.trim();
    localStorage.setItem(ANTHROPIC_KEY_STORAGE, val);
    anthropicInputs.forEach((other) => { if (other && other !== input) other.value = val; });
    const stateEl = document.getElementById('anthropic-save-state') || document.getElementById('ideas-key-state');
    if (stateEl) flashSaveState(stateEl, val ? 'Clé Anthropic sauvegardée ✓' : '');
    const ideasState = document.getElementById('ideas-key-state');
    if (ideasState) flashSaveState(ideasState, val ? 'Clé Anthropic sauvegardée ✓' : '');
  });
});

const NICHE_LABELS = {
  gaming: 'Gaming (clips, highlights, gameplay)',
  esport: 'Esport / Compétitif (tournois, pros, matchs)',
  incredible: 'Moments incroyables (WTF, surprises, réactions)',
  bigproject: 'Gros projets / Construction / Ingénierie',
  irl: 'IRL / Vlogs (quotidien, aventures, rencontres)',
  tech: 'Tech / Science / Vulgarisation',
  other: 'Contenu divers',
};

const PLATFORM_ADVICE = {
  tiktok: 'TikTok (format 15-60s, forte énergie dès la première seconde, texte à l\'écran)',
  shorts: 'YouTube Shorts (format ≤60s, vertical, algo favorise les boucles et le watch-time)',
  reels: 'Instagram Reels (format 15-90s, musique tendance, transitions visuelles)',
};

async function generateIdeas() {
  const apiKey = getAnthropicKey();
  const niche = els.ideasNiche.value;
  const platform = els.ideasPlatform.value;
  const history = els.ideasHistory.value.trim();
  const feedback = els.ideasFeedback.value.trim();

  if (!apiKey) {
    els.ideasKeyState.textContent = 'Ajoute ta clé Anthropic pour générer des idées.';
    els.ideasKeyState.classList.remove('is-visible');
    els.ideasApiKey.focus();
    return;
  }
  if (!niche) {
    els.ideasOutput.hidden = true;
    els.ideasOutput.innerHTML = '<p class="ideas-error">Sélectionne ta niche principale.</p>';
    els.ideasOutput.hidden = false;
    return;
  }

  els.ideasBtn.disabled = true;
  els.ideasBtn.classList.add('is-loading');
  els.ideasOutput.hidden = false;
  els.ideasOutput.innerHTML = `
    <div class="ideas-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p>Claude analyse ton profil et génère des idées…</p>
    </div>`;

  const prompt = `Tu es un expert en création de contenu viral sur les réseaux sociaux, spécialisé dans la niche ${NICHE_LABELS[niche] || niche}.

Profil du créateur :
- Niche : ${NICHE_LABELS[niche] || niche}
- Plateforme cible : ${PLATFORM_ADVICE[platform] || platform}
${history ? \`- Dernières vidéos postées :\n\${history.split('\n').map(l => '  • ' + l).join('\n')}\` : '- Pas encore de vidéos postées / pas de titres fournis'}
${feedback ? \`- Ce qui a fonctionné / pas fonctionné : \${feedback}\` : ''}

Génère exactement 8 idées de vidéos courtes CONCRÈTES et prêtes à produire.

Pour chaque idée tu dois fournir :
- Un titre final, percutant, prêt à publier (avec emojis si pertinent, style accrocheur adapté à la plateforme)
- Le format exact : durée recommandée + style de montage (ex : "45s — coupures rapides, musique épique, sous-titres grands")
- Pourquoi ça va marcher : 1 phrase ultra-courte et directe, basée sur ce qui fonctionne actuellement dans cette niche
- 3 hashtags ultra-ciblés pour maximiser la portée

Règles importantes :
- Les idées doivent être VARIÉES : pas toutes le même format ou le même angle
- Adapte le ton à la plateforme (TikTok = énergie folle, Shorts = boucle forte, Reels = esthétique + musique)
- Certaines idées doivent exploiter les tendances actuelles de la niche
- Si des vidéos passées sont mentionnées, propose des idées complémentaires ou des suites logiques

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
[
  {
    "title": "Titre accrocheur prêt à publier",
    "format": "45s — montage rapide + sous-titres grands",
    "why": "Pourquoi ça marche en une phrase",
    "hashtags": ["#tag1", "#tag2", "#tag3"]
  }
]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erreur API Anthropic : ${response.status}`);
    }

    const data = await response.json();
    const raw = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const ideas = JSON.parse(clean);
    renderIdeas(ideas, niche, platform);
  } catch (err) {
    console.error(err);
    els.ideasOutput.innerHTML = `<p class="ideas-error">Erreur : ${err.message}</p>`;
  } finally {
    els.ideasBtn.disabled = false;
    els.ideasBtn.classList.remove('is-loading');
  }
}

function renderIdeas(ideas, niche, platform) {
  const nicheEmoji = { gaming: '🎮', esport: '🏆', incredible: '🤯', bigproject: '🏗️', irl: '🎥', tech: '💡', other: '🎭' }[niche] || '💡';

  let html = `<div class="ideas-header">
    <span class="ideas-meta">${nicheEmoji} ${NICHE_LABELS[niche] || niche} — ${ideas.length} idées générées</span>
  </div>
  <div class="ideas-grid">`;

  ideas.forEach((idea, i) => {
    const pills = (idea.hashtags || []).map((h) => `<span class="idea-hashtag">${h}</span>`).join('');
    html += `
    <div class="idea-card" style="animation-delay:${i * 55}ms">
      <div class="idea-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="idea-body">
        <h3 class="idea-title">${escapeHtml(idea.title)}</h3>
        <div class="idea-format">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          ${escapeHtml(idea.format || '')}
        </div>
        <p class="idea-why">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="m13 2-2 2.5h3L12 7"/><path d="M10 14 2.3 6.3a2.4 2.4 0 0 1 3.4-3.4L13 10"/><path d="m6.6 11.5-1.1 1.1a2.4 2.4 0 1 0 3.4 3.4l6.9-6.9a2.4 2.4 0 0 0-3.4-3.4"/><path d="m14 14 2.5 2.5"/><path d="M22 22l-5-5"/></svg>
          ${escapeHtml(idea.why || '')}
        </p>
        <div class="idea-tags">${pills}</div>
      </div>
    </div>`;
  });

  html += `</div>
  <button id="ideas-copy-all" class="ghost-btn" style="margin-top:14px;width:100%;">
    Copier toutes les idées (texte)
  </button>`;

  els.ideasOutput.innerHTML = html;
  els.ideasOutput.hidden = false;

  document.getElementById('ideas-copy-all')?.addEventListener('click', async () => {
    const text = ideas.map((idea, i) =>
      `${i + 1}. ${idea.title}\n   Format : ${idea.format}\n   Pourquoi : ${idea.why}\n   Tags : ${(idea.hashtags || []).join(' ')}`
    ).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      document.getElementById('ideas-copy-all').textContent = 'Copié ✓';
    } catch { /* silent */ }
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

els.ideasBtn.addEventListener('click', generateIdeas);

// ---- PWA service worker registration ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
