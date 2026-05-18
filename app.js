const API_KEY = 'f40d9966d6b39627111499fdb5a3e3e7';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmNDBkOTk2NmQ2YjM5NjI3MTExNDk5ZmRiNWEzZTNlNyIsIm5iZiI6MTc3ODQ2NjA3My4zMzYsInN1YiI6IjZhMDEzZDE5MjZmOTljODlkNjI0MTlmYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.hJJIPICzHtPXvMkXhMC69sMrW1U3x21nDT5fXnjX1CY';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const HORROR_GENRE_ID = 27;

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const SCARE_KEYWORD_FLAT = {
  10713: { cat: 'gore', weight: 2 },
  156401: { cat: 'gore', weight: 2 },
  315983: { cat: 'gore', weight: 1.5 },
  3148: { cat: 'gore', weight: 1.5 },
  12371: { cat: 'supernatural', weight: 2 },
  9663: { cat: 'supernatural', weight: 1.5 },
  4565: { cat: 'supernatural', weight: 1.5 },
  187056: { cat: 'supernatural', weight: 2 },
  282599: { cat: 'supernatural', weight: 1.5 },
  10079: { cat: 'psychological', weight: 1.5 },
  163013: { cat: 'psychological', weight: 2 },
  282598: { cat: 'psychological', weight: 1.5 },
  11322: { cat: 'slasher', weight: 2.5 },
  12377: { cat: 'slasher', weight: 2 },
  161176: { cat: 'slasher', weight: 1.5 },
  173328: { cat: 'demonic', weight: 2.5 },
  6152: { cat: 'creature', weight: 2 },
  14966: { cat: 'creature', weight: 2 },
  251212: { cat: 'creature', weight: 1.5 },
  209714: { cat: 'creature', weight: 1.5 },
  282321: { cat: 'tension', weight: 2 },
  246559: { cat: 'tension', weight: 1.5 },
  282317: { cat: 'occult', weight: 2 },
};

const HORROR_SIGNAL_WORDS = [
  { words: ['slaughter', 'massacre', 'gore', 'guts', 'brutal'], cat: 'gore', weight: 2 },
  { words: ['demon', 'devil', 'satan', 'possessed', 'exorcism', 'possession'], cat: 'demonic', weight: 2.5 },
  { words: ['ghost', 'haunted', 'haunting', 'spirit', 'apparition', 'poltergeist'], cat: 'supernatural', weight: 2 },
  { words: ['slasher', 'knife', 'chainsaw', 'killer', 'serial'], cat: 'slasher', weight: 2 },
  { words: ['psycho', 'psychological', 'mind', 'paranoia', 'disturb'], cat: 'psychological', weight: 1.5 },
  { words: ['monster', 'creature', 'beast', 'alien', 'mutant'], cat: 'creature', weight: 1.8 },
  { words: ['cult', 'ritual', 'occult', 'witch', 'coven', 'satanic'], cat: 'occult', weight: 2 },
  { words: ['zombie', 'undead', 'infected', 'plague'], cat: 'creature', weight: 1.8 },
  { words: ['fear', 'terror', 'dread', 'nightmare', 'trapped', 'survive'], cat: 'tension', weight: 1.2 },
  { words: ['jump', 'shock', 'startl'], cat: 'tension', weight: 1.5 },
];

const SCARY_GENRES = { 27: 10, 53: 3, 9648: 2, 878: 1 };

function calcScareBreakdown(movie, keywords, credits) {
  const cats = { gore: 0, supernatural: 0, psychological: 0, slasher: 0, demonic: 0, creature: 0, tension: 0, occult: 0 };

  for (const kw of keywords) {
    const entry = SCARE_KEYWORD_FLAT[kw.id];
    if (entry) cats[entry.cat] = Math.min(cats[entry.cat] + entry.weight, 10);
  }

  const text = `${movie.title || ''} ${movie.overview || ''}`.toLowerCase();
  for (const signal of HORROR_SIGNAL_WORDS) {
    if (signal.words.some(w => text.includes(w))) {
      cats[signal.cat] = Math.min(cats[signal.cat] + signal.weight, 10);
    }
  }

  for (const g of movie.genres || []) {
    const bonus = SCARY_GENRES[g.id] || 0;
    if (bonus > 0) cats.tension = Math.min(cats.tension + bonus * 0.3, 10);
  }

  cats.tension = Math.min(cats.tension + Math.min((movie.popularity || 0) / 300, 1), 10);
  const voteAvg = movie.vote_average || 5;
  cats.tension = Math.min(cats.tension + (voteAvg > 7 ? 1 : voteAvg > 6 ? 0.5 : 0), 10);

  const weights = { gore: 1.4, demonic: 1.3, slasher: 1.2, supernatural: 1.1, creature: 1.0, occult: 1.0, psychological: 0.9, tension: 0.7 };
  let weighted = 0, maxPossible = 0;
  for (const [cat, val] of Object.entries(cats)) {
    weighted += val * (weights[cat] || 1);
    maxPossible += 10 * (weights[cat] || 1);
  }

  let score = (weighted / maxPossible) * 10;
  const isHorror = (movie.genres || []).some(g => g.id === HORROR_GENRE_ID) || (movie.genre_ids || []).includes(HORROR_GENRE_ID);
  if (isHorror && score < 2) score = 2;
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, cats };
}

const DESCRIPTORS = [
  { max: 1.9, label: 'Barely a chill', icon: '🥱', color: '#27ae60' },
  { max: 3.4, label: 'Mildly spooky', icon: '🙂', color: '#2ecc71' },
  { max: 4.9, label: 'Unsettling', icon: '😐', color: '#f1c40f' },
  { max: 5.9, label: 'Creepy', icon: '😟', color: '#f39c12' },
  { max: 6.9, label: 'Frightening', icon: '😨', color: '#e67e22' },
  { max: 7.9, label: 'Terrifying', icon: '😱', color: '#e74c3c' },
  { max: 8.9, label: 'Nightmare fuel', icon: '😰', color: '#c0392b' },
  { max: 10,  label: 'Pure horror',    icon: '💀', color: '#8e44ad' },
];

function getDescriptor(score) {
  return DESCRIPTORS.find(d => score <= d.max) || DESCRIPTORS[DESCRIPTORS.length - 1];
}
function scareClass(score) { return `scare-${Math.round(Math.max(1, Math.min(10, score)))}`; }
function scareIcons(score) { return '💀'.repeat(Math.max(0, Math.round(score / 2))); }

async function tmdb(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function searchMovies(query) {
  const data = await tmdb('/search/movie', { query, include_adult: false });
  return data.results || [];
}

async function getTrending() {
  const data = await tmdb('/trending/movie/week');
  const horror = (data.results || []).filter(m => (m.genre_ids || []).includes(HORROR_GENRE_ID));
  if (horror.length >= 6) return horror.slice(0, 12);
  const extra = await tmdb('/discover/movie', { with_genres: HORROR_GENRE_ID, sort_by: 'popularity.desc', 'vote_count.gte': 100 });
  return (extra.results || []).slice(0, 12);
}

async function getMovieDetails(id) {
  const [movie, credits, keywords] = await Promise.all([
    tmdb(`/movie/${id}`, { append_to_response: 'release_dates' }),
    tmdb(`/movie/${id}/credits`),
    tmdb(`/movie/${id}/keywords`),
  ]);
  return { movie, credits, keywords: keywords.keywords || [] };
}

function posterUrl(path, size = 'w342') { return path ? `${IMG}/${size}${path}` : null; }

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderCard(movie, score) {
  const poster = posterUrl(movie.poster_path);
  const year = (movie.release_date || '').slice(0, 4);
  const desc = getDescriptor(score);
  return `
    <div class="movie-card" data-id="${movie.id}">
      ${poster ? `<img class="card-poster" src="${poster}" alt="${escHtml(movie.title)}" loading="lazy" />` : `<div class="card-no-poster">🎬<span>No poster</span></div>`}
      <div class="card-info">
        <div class="card-title">${escHtml(movie.title)}</div>
        ${year ? `<div class="card-year">${year}</div>` : ''}
        <span class="scare-badge ${scareClass(score)}">${desc.icon} ${score}/10</span>
      </div>
    </div>`;
}

function renderDetail(movie, credits, keywords, breakdown) {
  const { score, cats } = breakdown;
  const desc = getDescriptor(score);
  const poster = posterUrl(movie.poster_path, 'w500');
  const year = (movie.release_date || '').slice(0, 4);
  const runtime = movie.runtime ? `${movie.runtime}m` : '';
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  const votes = movie.vote_count ? movie.vote_count.toLocaleString() : '';
  const genres = (movie.genres || []).map(g => `<span class="genre-tag">${escHtml(g.name)}</span>`).join('');
  const cast = (credits.cast || []).slice(0, 8).map(c => `<span class="cast-chip">${escHtml(c.name)}</span>`).join('');
  const director = (credits.crew || []).find(c => c.job === 'Director');
  const meterPct = (score / 10) * 100;
  const catLabels = { gore: 'Gore', supernatural: 'Supernatural', psychological: 'Psychological', slasher: 'Slasher', demonic: 'Demonic', creature: 'Creature / Monster', tension: 'Tension', occult: 'Occult' };

  const breakdownItems = Object.entries(cats)
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => `
      <div class="breakdown-item">
        <div class="breakdown-name"><span>${catLabels[cat] || cat}</span><strong>${val.toFixed(1)}</strong></div>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:${(val/10)*100}%;background:${desc.color}"></div></div>
      </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">No specific scare signals detected.</p>';

  return `
    <div class="detail-layout">
      <div class="detail-poster-wrap">
        ${poster ? `<img class="detail-poster" src="${poster}" alt="${escHtml(movie.title)}" />` : `<div class="detail-no-poster">🎬</div>`}
        <div class="scare-meter-wrap">
          <div class="scare-label">Scare Factor</div>
          <div class="scare-score" style="color:${desc.color}">${score}</div>
          <div class="scare-descriptor" style="color:${desc.color}">${desc.icon} ${desc.label}</div>
          <div class="scare-bar-track"><div class="scare-bar-fill" style="width:${meterPct}%;background:linear-gradient(90deg,${desc.color}aa,${desc.color})"></div></div>
          <div class="scare-icons">${scareIcons(score)}</div>
        </div>
      </div>
      <div class="detail-info">
        <h2>${escHtml(movie.title)}</h2>
        <div class="detail-meta">
          ${year ? `<span>${year}</span><span class="meta-dot">·</span>` : ''}
          ${runtime ? `<span>${runtime}</span><span class="meta-dot">·</span>` : ''}
          ${director ? `<span>Dir. ${escHtml(director.name)}</span><span class="meta-dot">·</span>` : ''}
          <span>⭐ ${rating}</span>
          ${votes ? `<span class="meta-dot">·</span><span>${votes} votes</span>` : ''}
        </div>
        <div class="genre-tags">${genres}</div>
        ${movie.overview ? `<p class="detail-overview">${escHtml(movie.overview)}</p>` : ''}
        <div class="stats-row">
          <div class="stat-card"><div class="stat-value" style="color:${desc.color}">${score}</div><div class="stat-name">Scare Score</div></div>
          <div class="stat-card"><div class="stat-value">${rating}</div><div class="stat-name">TMDB Rating</div></div>
          ${movie.popularity ? `<div class="stat-card"><div class="stat-value">${Math.round(movie.popularity)}</div><div class="stat-name">Popularity</div></div>` : ''}
          ${movie.budget > 0 ? `<div class="stat-card"><div class="stat-value">$${(movie.budget/1e6).toFixed(0)}M</div><div class="stat-name">Budget</div></div>` : ''}
        </div>
        <div class="scare-breakdown"><h3>Scare breakdown</h3><div class="breakdown-grid">${breakdownItems}</div></div>
        ${cast ? `<div class="cast-section"><h3>Cast</h3><div class="cast-list">${cast}</div></div>` : ''}
      </div>
    </div>`;
}

let currentResults = [];
let suggestTimer = null;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function showSpinner(container) {
  container.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
}

function showSection(id) {
  ['resultsSection', 'movieDetail', 'trendingSection'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

function quickScare(movie) { return calcScareBreakdown(movie, [], null).score; }

async function openMovie(id) {
  const content = document.getElementById('detailContent');
  showSection('movieDetail');
  showSpinner(content);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try {
    const { movie, credits, keywords } = await getMovieDetails(id);
    const breakdown = calcScareBreakdown(movie, keywords, credits);
    content.innerHTML = renderDetail(movie, credits, keywords, breakdown);
    requestAnimationFrame(() => {
      document.querySelectorAll('.scare-bar-fill, .breakdown-bar-fill').forEach(el => {
        const w = el.style.width; el.style.width = '0';
        requestAnimationFrame(() => { el.style.width = w; });
      });
    });
  } catch (e) {
    content.innerHTML = `<p style="color:var(--text-muted);padding:2rem">Failed to load movie details.</p>`;
    console.error(e);
  }
}

async function doSearch(query) {
  if (!query.trim()) return;
  const resultsGrid = document.getElementById('results');
  showSection('resultsSection');
  showSpinner(resultsGrid);
  try {
    const movies = await searchMovies(query);
    currentResults = movies;
    if (!movies.length) {
      resultsGrid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:2rem 0">No films found. Try a different search.</p>';
      return;
    }
    resultsGrid.innerHTML = movies.map(m => renderCard(m, quickScare(m))).join('');
    bindCardClicks(resultsGrid);
  } catch (e) {
    resultsGrid.innerHTML = '<p style="color:var(--accent);grid-column:1/-1;padding:2rem 0">Error fetching results.</p>';
    console.error(e);
  }
}

function bindCardClicks(container) {
  container.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => openMovie(card.dataset.id));
  });
}

async function loadTrending() {
  const grid = document.getElementById('trendingGrid');
  showSpinner(grid);
  try {
    const movies = await getTrending();
    grid.innerHTML = movies.map(m => renderCard(m, quickScare(m))).join('');
    bindCardClicks(grid);
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Could not load trending horror.</p>';
  }
}

async function showSuggestions(query) {
  const box = document.getElementById('suggestions');
  if (!query.trim()) { box.classList.add('hidden'); return; }
  try {
    const movies = await searchMovies(query);
    const top = movies.slice(0, 5);
    if (!top.length) { box.classList.add('hidden'); return; }
    box.innerHTML = top.map(m => {
      const thumb = posterUrl(m.poster_path, 'w92');
      const year = (m.release_date || '').slice(0, 4);
      return `<div class="suggestion-item" data-id="${m.id}">
        ${thumb ? `<img src="${thumb}" alt="" />` : `<div class="suggestion-no-img">🎬</div>`}
        <div class="suggestion-info">
          <div class="suggestion-title">${escHtml(m.title)}</div>
          ${year ? `<div class="suggestion-year">${year}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => { box.classList.add('hidden'); openMovie(item.dataset.id); });
    });
  } catch { box.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');
  const suggestions = document.getElementById('suggestions');
  const backBtn = document.getElementById('backBtn');

  btn.addEventListener('click', () => { suggestions.classList.add('hidden'); doSearch(input.value); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { suggestions.classList.add('hidden'); doSearch(input.value); } });
  input.addEventListener('input', () => { clearTimeout(suggestTimer); suggestTimer = setTimeout(() => showSuggestions(input.value), 300); });
  document.addEventListener('click', e => { if (!e.target.closest('.search-section')) suggestions.classList.add('hidden'); });
  backBtn.addEventListener('click', () => {
    showSection(currentResults.length ? 'resultsSection' : 'trendingSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  loadTrending();
});
