// ── Config ───────────────────────────────────────────────────────────────────
const TMDB_KEY   = 'f40d9966d6b39627111499fdb5a3e3e7';
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmNDBkOTk2NmQ2YjM5NjI3MTExNDk5ZmRiNWEzZTNlNyIsIm5iZiI6MTc3ODQ2NjA3My4zMzYsInN1YiI6IjZhMDEzZDE5MjZmOTljODlkNjI0MTlmYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.hJJIPICzHtPXvMkXhMC69sMrW1U3x21nDT5fXnjX1CY';
// Free OMDB key (get your own at https://www.omdbapi.com/apikey.aspx)
const OMDB_KEY   = 'trilogy';

const TMDB_BASE  = 'https://api.themoviedb.org/3';
const IMG_BASE   = 'https://image.tmdb.org/t/p';
const OMDB_BASE  = 'https://www.omdbapi.com';
const HORROR_ID  = 27;

const tmdbHeaders = { Authorization: `Bearer ${TMDB_TOKEN}` };

// ── Scare engine ──────────────────────────────────────────────────────────────

const KEYWORD_MAP = {
  10713:  { cat: 'gore',          weight: 2   },
  156401: { cat: 'gore',          weight: 2   },
  315983: { cat: 'gore',          weight: 1.5 },
  3148:   { cat: 'gore',          weight: 1.5 },
  12371:  { cat: 'supernatural',  weight: 2   },
  9663:   { cat: 'supernatural',  weight: 1.5 },
  4565:   { cat: 'supernatural',  weight: 1.5 },
  187056: { cat: 'supernatural',  weight: 2   },
  282599: { cat: 'supernatural',  weight: 1.5 },
  10079:  { cat: 'psychological', weight: 1.5 },
  163013: { cat: 'psychological', weight: 2   },
  282598: { cat: 'psychological', weight: 1.5 },
  11322:  { cat: 'slasher',       weight: 2.5 },
  12377:  { cat: 'slasher',       weight: 2   },
  161176: { cat: 'slasher',       weight: 1.5 },
  173328: { cat: 'demonic',       weight: 2.5 },
  6152:   { cat: 'creature',      weight: 2   },
  14966:  { cat: 'creature',      weight: 2   },
  251212: { cat: 'creature',      weight: 1.5 },
  209714: { cat: 'creature',      weight: 1.5 },
  282321: { cat: 'tension',       weight: 2   },
  246559: { cat: 'tension',       weight: 1.5 },
  282317: { cat: 'occult',        weight: 2   },
};

const TEXT_SIGNALS = [
  { words: ['slaughter','massacre','gore','guts','brutal'],               cat: 'gore',          weight: 2   },
  { words: ['demon','devil','satan','possessed','exorcism','possession'], cat: 'demonic',       weight: 2.5 },
  { words: ['ghost','haunted','haunting','spirit','apparition','poltergeist'], cat: 'supernatural', weight: 2 },
  { words: ['slasher','chainsaw','killer','serial'],                      cat: 'slasher',       weight: 2   },
  { words: ['psycho','psychological','paranoia','disturb'],               cat: 'psychological', weight: 1.5 },
  { words: ['monster','creature','beast','alien','mutant'],               cat: 'creature',      weight: 1.8 },
  { words: ['cult','ritual','occult','witch','coven','satanic'],          cat: 'occult',        weight: 2   },
  { words: ['zombie','undead','infected','plague'],                       cat: 'creature',      weight: 1.8 },
  { words: ['fear','terror','dread','nightmare','trapped','survive'],     cat: 'tension',       weight: 1.2 },
  { words: ['jump scare','shock'],                                        cat: 'tension',       weight: 1.5 },
];

const CAT_WEIGHTS = { gore:1.4, demonic:1.3, slasher:1.2, supernatural:1.1, creature:1.0, occult:1.0, psychological:0.9, tension:0.7 };
const CAT_LABELS  = { gore:'Gore', supernatural:'Supernatural', psychological:'Psychological', slasher:'Slasher', demonic:'Demonic', creature:'Creature / Monster', tension:'Tension', occult:'Occult' };

function calcScare(movie, keywords = [], rtScore = null) {
  const cats = { gore:0, supernatural:0, psychological:0, slasher:0, demonic:0, creature:0, tension:0, occult:0 };

  for (const kw of keywords) {
    const e = KEYWORD_MAP[kw.id];
    if (e) cats[e.cat] = Math.min(cats[e.cat] + e.weight, 10);
  }

  const text = `${movie.title||''} ${movie.overview||''}`.toLowerCase();
  for (const sig of TEXT_SIGNALS) {
    if (sig.words.some(w => text.includes(w)))
      cats[sig.cat] = Math.min(cats[sig.cat] + sig.weight, 10);
  }

  const genreBonus = { [HORROR_ID]:3, 53:0.9, 9648:0.6, 878:0.3 };
  for (const g of (movie.genres || [])) {
    const b = genreBonus[g.id] || 0;
    if (b) cats.tension = Math.min(cats.tension + b * 0.3, 10);
  }
  for (const id of (movie.genre_ids || [])) {
    const b = genreBonus[id] || 0;
    if (b) cats.tension = Math.min(cats.tension + b * 0.3, 10);
  }

  cats.tension = Math.min(cats.tension + Math.min((movie.popularity||0)/300, 1), 10);
  const va = movie.vote_average || 5;
  cats.tension = Math.min(cats.tension + (va>7?1:va>6?0.5:0), 10);

  if (rtScore !== null) {
    const rtBonus = (rtScore / 100) * 1.5;
    cats.tension = Math.min(cats.tension + rtBonus, 10);
  }

  const isHorror = (movie.genres||[]).some(g=>g.id===HORROR_ID) || (movie.genre_ids||[]).includes(HORROR_ID);

  let rawScore = 0;
  for (const [cat, val] of Object.entries(cats)) {
    rawScore += val * (CAT_WEIGHTS[cat] || 1);
  }

  let score = 1 + (rawScore / 15) * 4;
  score = Math.max(1, Math.min(5, Math.round(score)));
  return { score, cats };
}

const DESCRIPTORS = [
  { max:1, label:'Not that Scary',      icon:'😴', color:'#27ae60' },
  { max:2, label:'Bit Spooky',          icon:'🙂', color:'#c87800' },
  { max:3, label:'In for a good scare', icon:'😨', color:'#e67e22' },
  { max:4, label:'Tough as nails',      icon:'😱', color:'#c00000' },
  { max:5, label:'Nightmare fuel',      icon:'💀', color:'#8e44ad' },
];

function descriptor(score) { return DESCRIPTORS.find(d=>score<=d.max)||DESCRIPTORS[DESCRIPTORS.length-1]; }
function scareClass(score) { return `scare-${Math.max(1,Math.min(5,Math.round(score)))}`; }
function scareIcons(score) { return '💀'.repeat(Math.max(0,Math.round(score))); }

// ── API helpers ───────────────────────────────────────────────────────────────

async function tmdb(path, params={}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const res = await fetch(url, { headers: tmdbHeaders });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function fetchRt(title, year) {
  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set('apikey', OMDB_KEY);
    url.searchParams.set('t', title);
    if (year) url.searchParams.set('y', year);
    url.searchParams.set('r', 'json');
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;
    const rt = (data.Ratings||[]).find(r=>r.Source==='Rotten Tomatoes');
    return rt ? parseInt(rt.Value) : null;
  } catch { return null; }
}

async function searchMovies(query) {
  const d = await tmdb('/search/movie', { query, include_adult:false });
  return (d.results || []).filter(m => (m.genre_ids||[]).includes(HORROR_ID));
}

async function getDetails(id) {
  const [movie, credits, kw] = await Promise.all([
    tmdb(`/movie/${id}`),
    tmdb(`/movie/${id}/credits`),
    tmdb(`/movie/${id}/keywords`),
  ]);
  return { movie, credits, keywords: kw.keywords||[] };
}

// ── Render helpers ────────────────────────────────────────────────────────────

function posterUrl(path, size='w342') { return path ? `${IMG_BASE}/${size}${path}` : null; }

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCard(movie, score, gore) {
  const poster   = posterUrl(movie.poster_path);
  const year     = (movie.release_date||'').slice(0,4);
  const desc     = descriptor(score);
  const gorePct  = Math.round((gore / 10) * 100);
  const goreColor = gore >= 7 ? '#c00000' : gore >= 4 ? '#e67e22' : '#555';
  return `
    <div class="movie-card" data-id="${movie.id}">
      ${poster ? `<img class="card-poster" src="${poster}" alt="${esc(movie.title)}" loading="lazy" />`
               : `<div class="card-no-poster">🎬<span>No poster</span></div>`}
      <div class="card-info">
        <div class="card-title">${esc(movie.title)}</div>
        ${year ? `<div class="card-year">${year}</div>` : ''}
        <span class="scare-badge ${scareClass(score)}">${desc.icon} ${score}/5</span>
        <div class="gore-meter">
          <span class="gore-label">GORE</span>
          <div class="gore-track"><div class="gore-fill" style="width:${gorePct}%;background:${goreColor}"></div></div>
        </div>
      </div>
    </div>`;
}

function renderDetail(movie, credits, keywords, breakdown, rtScore) {
  const { score, cats } = breakdown;
  const desc     = descriptor(score);
  const poster   = posterUrl(movie.poster_path, 'w500');
  const year     = (movie.release_date||'').slice(0,4);
  const runtime  = movie.runtime ? `${movie.runtime}m` : '';
  const rating   = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  const votes    = movie.vote_count ? movie.vote_count.toLocaleString() : '';
  const director = (credits.crew||[]).find(c=>c.job==='Director');
  const genres   = (movie.genres||[]).map(g=>`<span class="genre-tag">${esc(g.name)}</span>`).join('');
  const cast     = (credits.cast||[]).slice(0,8).map(c=>`<span class="cast-chip">${esc(c.name)}</span>`).join('');

  const breakdownItems = Object.entries(cats)
    .filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
    .map(([cat,val])=>`
      <div class="breakdown-item">
        <div class="breakdown-name"><span>${CAT_LABELS[cat]||cat}</span><strong>${val.toFixed(1)}</strong></div>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:${(val/10)*100}%;background:${desc.color}"></div></div>
      </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.84rem">No specific scare signals detected.</p>';

  const rtBadge = rtScore !== null
    ? `<div class="stat-card"><div class="stat-value" style="color:${rtScore>=60?'#f39c12':'#888899'}">${rtScore}%</div><div class="stat-name">🍅 Tomatometer</div></div>`
    : `<div class="stat-card" id="rtPlaceholder"><div class="stat-value" style="color:var(--text-muted)">—</div><div class="stat-name">🍅 Tomatometer</div></div>`;

  return `
    <div class="detail-layout">
      <div>
        ${poster ? `<img class="detail-poster" src="${poster}" alt="${esc(movie.title)}" />`
                 : `<div class="detail-no-poster">🎬</div>`}
        <div class="scare-meter-wrap">
          <div class="scare-label">Scare Factor</div>
          <div class="scare-score" style="color:${desc.color}">${score}</div>
          <div class="scare-descriptor" style="color:${desc.color}">${desc.icon} ${desc.label}</div>
          <div class="scare-bar-track">
            <div class="scare-bar-fill" style="width:${(score/5)*100}%;background:linear-gradient(90deg,${desc.color}aa,${desc.color})"></div>
          </div>
          <div class="scare-icons">${scareIcons(score)}</div>
        </div>
      </div>
      <div class="detail-info">
        <h2>${esc(movie.title)}</h2>
        <div class="detail-meta">
          ${year     ? `<span>${year}</span><span class="meta-dot">·</span>` : ''}
          ${runtime  ? `<span>${runtime}</span><span class="meta-dot">·</span>` : ''}
          ${director ? `<span>Dir. ${esc(director.name)}</span><span class="meta-dot">·</span>` : ''}
          <span>⭐ ${rating}</span>
          ${votes ? `<span class="meta-dot">·</span><span>${votes} votes</span>` : ''}
        </div>
        <div class="genre-tags">${genres}</div>
        ${movie.overview ? `<p class="detail-overview">${esc(movie.overview)}</p>` : ''}

        <div class="stats-row" id="statsRow">
          <div class="stat-card">
            <div class="stat-value" style="color:${desc.color}">${score}/5</div>
            <div class="stat-name">Scare Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${rating}</div>
            <div class="stat-name">TMDB Rating</div>
          </div>
          ${rtBadge}
          ${movie.popularity ? `<div class="stat-card"><div class="stat-value">${Math.round(movie.popularity)}</div><div class="stat-name">Popularity</div></div>` : ''}
        </div>

        <div class="scare-breakdown">
          <h3>Scare breakdown</h3>
          <div class="breakdown-grid">${breakdownItems}</div>
        </div>

        ${cast ? `<div class="cast-section"><h3>Cast</h3><div class="cast-list">${cast}</div></div>` : ''}
      </div>
    </div>`;
}

// ── Compare state ─────────────────────────────────────────────────────────────

const compareList = []; // { movie, breakdown }
const MAX_COMPARE = 4;

function addToCompare(movie, breakdown) {
  if (compareList.length >= MAX_COMPARE) { showToast(`Max ${MAX_COMPARE} films`); return false; }
  if (compareList.some(e=>e.movie.id===movie.id)) { showToast('Already added'); return false; }
  compareList.push({ movie, breakdown });
  renderCompare();
  return true;
}

function removeFromCompare(id) {
  const idx = compareList.findIndex(e=>e.movie.id===+id);
  if (idx !== -1) compareList.splice(idx,1);
  renderCompare();
}

function renderCompare() {
  const slots = document.getElementById('compareSlots');
  const chart  = document.getElementById('compareChart');

  if (!compareList.length) {
    slots.innerHTML = '<div class="compare-empty-hint">Search above to add films — up to 4 at once</div>';
    chart.classList.add('hidden');
    return;
  }

  const best = compareList.reduce((a,b)=>a.breakdown.score>=b.breakdown.score?a:b);

  slots.innerHTML = compareList.map(({ movie, breakdown }) => {
    const { score, cats } = breakdown;
    const desc   = descriptor(score);
    const poster = posterUrl(movie.poster_path, 'w342');
    const year   = (movie.release_date||'').slice(0,4);
    const isWin  = movie.id === best.movie.id;

    const topCats = Object.entries(cats).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const miniBars = topCats.map(([cat,val])=>`
      <div class="compare-mini-row">
        <span class="compare-mini-label">${CAT_LABELS[cat]||cat}</span>
        <div class="compare-mini-track"><div class="compare-mini-fill" style="width:${(val/10)*100}%;background:${desc.color}"></div></div>
        <span class="compare-mini-val">${val.toFixed(1)}</span>
      </div>`).join('');

    return `
      <div class="compare-card ${isWin?'is-winner':''}">
        <button class="compare-remove" data-id="${movie.id}">✕</button>
        ${poster ? `<img class="compare-card-poster" src="${poster}" alt="${esc(movie.title)}" loading="lazy" />`
                 : `<div class="compare-card-no-poster">🎬</div>`}
        <div class="compare-card-info">
          <div class="compare-card-title">${esc(movie.title)}</div>
          ${year ? `<div class="compare-card-year">${year}</div>` : ''}
          <div class="compare-score-row">
            <div class="compare-score-big" style="color:${desc.color}">${score}</div>
            <div>
              <div class="compare-desc" style="color:${desc.color}">${desc.icon} ${desc.label}</div>
            </div>
          </div>
          <div class="compare-mini-bars">${miniBars}</div>
        </div>
        ${isWin && compareList.length>1 ? '<div class="winner-crown">👑 Scariest</div>' : ''}
      </div>`;
  }).join('');

  slots.querySelectorAll('.compare-remove').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); removeFromCompare(btn.dataset.id); });
  });

  if (compareList.length > 1) {
    chart.classList.remove('hidden');
    const maxScore = Math.max(...compareList.map(e=>e.breakdown.score));
    const rows = compareList
      .slice().sort((a,b)=>b.breakdown.score-a.breakdown.score)
      .map(({ movie, breakdown }) => {
        const { score } = breakdown;
        const desc = descriptor(score);
        const pct  = (score / 5) * 100;
        return `
          <div class="chart-row">
            <span class="chart-label" title="${esc(movie.title)}">${esc(movie.title)}</span>
            <div class="chart-track"><div class="chart-fill" style="width:${pct}%;background:${desc.color}"></div></div>
            <span class="chart-val" style="color:${desc.color}">${score}</span>
          </div>`;
      }).join('');

    chart.innerHTML = `<h3>Scare Ranking</h3>${rows}`;

    requestAnimationFrame(()=>{
      chart.querySelectorAll('.chart-fill').forEach(el=>{
        const w = el.style.width; el.style.width='0';
        requestAnimationFrame(()=>{ el.style.width=w; });
      });
    });
  } else {
    chart.classList.add('hidden');
  }
}

// ── Suggestions ───────────────────────────────────────────────────────────────

function buildSuggestions(movies, onSelect) {
  return movies.slice(0,6).map(m=>{
    const thumb = posterUrl(m.poster_path,'w92');
    const year  = (m.release_date||'').slice(0,4);
    return `
      <div class="suggestion-item" data-id="${m.id}">
        ${thumb ? `<img src="${thumb}" alt="" />` : `<div class="suggestion-no-img">🎬</div>`}
        <div class="suggestion-info">
          <div class="suggestion-title">${esc(m.title)}</div>
          ${year?`<div class="suggestion-year">${year}</div>`:''}
        </div>
      </div>`;
  }).join('');
}

function bindSuggestions(boxEl, movies, onSelect) {
  boxEl.innerHTML = buildSuggestions(movies);
  boxEl.classList.remove('hidden');
  boxEl.querySelectorAll('.suggestion-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      boxEl.classList.add('hidden');
      onSelect(+item.dataset.id, movies.find(m=>m.id===+item.dataset.id));
    });
  });
}

// ── Sections ──────────────────────────────────────────────────────────────────

const SECTIONS = ['homeSection','resultsSection','movieDetail','compareSection'];

function showSection(id) {
  SECTIONS.forEach(s=>document.getElementById(s).classList.toggle('hidden', s!==id));
}

// ── Detail view ───────────────────────────────────────────────────────────────

let detailBackTarget = 'homeSection';

async function openMovie(id, backTarget='homeSection') {
  detailBackTarget = backTarget;
  const content = document.getElementById('detailContent');
  showSection('movieDetail');
  content.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  window.scrollTo({ top:0, behavior:'smooth' });

  try {
    const { movie, credits, keywords } = await getDetails(id);
    const breakdown = calcScare(movie, keywords, null);
    content.innerHTML = renderDetail(movie, credits, keywords, breakdown, null);
    animateBars();

    const year = (movie.release_date||'').slice(0,4);
    fetchRt(movie.title, year).then(rtScore => {
      if (rtScore === null) return;
      const placeholder = document.getElementById('rtPlaceholder');
      if (!placeholder) return;
      const desc = descriptor(breakdown.score);
      placeholder.outerHTML = `<div class="stat-card"><div class="stat-value" style="color:${rtScore>=60?'#f39c12':'#888899'}">${rtScore}%</div><div class="stat-name">🍅 Tomatometer</div></div>`;
    });

  } catch (e) {
    content.innerHTML = '<p style="color:var(--text-muted);padding:2rem">Failed to load details.</p>';
    console.error(e);
  }
}

function animateBars() {
  requestAnimationFrame(()=>{
    document.querySelectorAll('.scare-bar-fill,.breakdown-bar-fill').forEach(el=>{
      const w=el.style.width; el.style.width='0';
      requestAnimationFrame(()=>{ el.style.width=w; });
    });
  });
}

// ── Search (main) ─────────────────────────────────────────────────────────────

let currentResults = [];
let suggestTimer   = null;

async function doSearch(query) {
  if (!query.trim()) return;
  const grid = document.getElementById('results');
  document.getElementById('resultsTitle').textContent = `"${query}"`;
  showSection('resultsSection');
  grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  try {
    const movies = await searchMovies(query);
    currentResults = movies;
    if (!movies.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:2rem 0">No horror films found.</p>';
      return;
    }
    grid.innerHTML = movies.map(m=>{ const { score, cats } = calcScare(m); return renderCard(m, score, cats.gore); }).join('');
    grid.querySelectorAll('.movie-card').forEach(c=>{
      c.addEventListener('click',()=>openMovie(+c.dataset.id,'resultsSection'));
    });
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--accent);grid-column:1/-1;padding:2rem 0">Error fetching results.</p>';
  }
}

// ── Compare search ────────────────────────────────────────────────────────────

let compareTimer = null;

async function addFilmToCompare(id, movieSnippet) {
  document.getElementById('compareSearchInput').value = '';
  document.getElementById('compareSuggestions').classList.add('hidden');

  if (compareList.some(e=>e.movie.id===id)) { showToast('Already in compare'); return; }
  if (compareList.length >= MAX_COMPARE)     { showToast(`Max ${MAX_COMPARE} films`); return; }

  try {
    const { movie, keywords } = await getDetails(id);
    const breakdown = calcScare(movie, keywords, null);
    addToCompare(movie, breakdown);

    const year = (movie.release_date||'').slice(0,4);
    fetchRt(movie.title, year).then(rtScore => {
      if (rtScore === null) return;
      const entry = compareList.find(e=>e.movie.id===id);
      if (!entry) return;
      entry.breakdown = calcScare(movie, keywords, rtScore);
      renderCompare();
    });
  } catch(e) {
    showToast('Could not load film');
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.add('hidden'), 2500);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

async function loadSidebar() {
  const list = document.getElementById('sidebarList');
  try {
    const data = await tmdb('/discover/movie', {
      with_genres: HORROR_ID,
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,
      page: 1,
    });
    const movies = (data.results || []).slice(0, 12);
    const scored = movies
      .map(m => ({ m, score: calcScare(m).score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (!scored.length) { list.innerHTML = '<div class="sidebar-loading">None found</div>'; return; }

    list.innerHTML = scored.map(({ m, score }) => {
      const desc  = descriptor(score);
      const thumb = posterUrl(m.poster_path, 'w92');
      const year  = (m.release_date||'').slice(0,4);
      return `
        <div class="sidebar-item" data-id="${m.id}">
          ${thumb
            ? `<img class="sidebar-thumb" src="${thumb}" alt="" loading="lazy" />`
            : `<div class="sidebar-no-thumb">🎬</div>`}
          <div class="sidebar-info">
            <div class="sidebar-name">${esc(m.title)}${year ? ` <span style="color:var(--text-muted);font-weight:400">(${year})</span>` : ''}</div>
            <div class="sidebar-score" style="color:${desc.color}">${desc.icon} ${score}/5</div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.sidebar-item').forEach(el => {
      el.addEventListener('click', () => openMovie(+el.dataset.id, 'homeSection'));
    });
  } catch {
    list.innerHTML = '<div class="sidebar-loading">Unavailable</div>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadSidebar();

  const searchInput = document.getElementById('searchInput');
  const searchBtn   = document.getElementById('searchBtn');
  const suggestions = document.getElementById('suggestions');

  function runMainSearch() {
    suggestions.classList.add('hidden');
    doSearch(searchInput.value);
  }

  searchBtn.addEventListener('click', runMainSearch);
  searchInput.addEventListener('keydown', e=>{ if(e.key==='Enter') runMainSearch(); });
  searchInput.addEventListener('input', ()=>{
    clearTimeout(suggestTimer);
    const q = searchInput.value.trim();
    if (!q) { suggestions.classList.add('hidden'); return; }
    suggestTimer = setTimeout(async ()=>{
      const movies = await searchMovies(q).catch(()=>[]);
      if (!movies.length) { suggestions.classList.add('hidden'); return; }
      bindSuggestions(suggestions, movies, (id, m)=>openMovie(id,'homeSection'));
    }, 280);
  });

  document.getElementById('resultsBackBtn').addEventListener('click', ()=>{
    showSection('homeSection');
    window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('backBtn').addEventListener('click', ()=>{
    showSection(detailBackTarget);
    window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('compareLaunchBtn').addEventListener('click', ()=>{
    showSection('compareSection');
    window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('compareBackBtn').addEventListener('click', ()=>{
    showSection('homeSection');
    window.scrollTo({top:0,behavior:'smooth'});
  });

  const cInput = document.getElementById('compareSearchInput');
  const cBtn   = document.getElementById('compareSearchBtn');
  const cSugg  = document.getElementById('compareSuggestions');

  function runCompareSearch() {
    const q = cInput.value.trim();
    if (!q) return;
    cSugg.classList.add('hidden');
    searchMovies(q).then(movies=>{
      if (!movies.length) { showToast('No horror films found'); return; }
      bindSuggestions(cSugg, movies, (id,m)=>addFilmToCompare(id,m));
      cSugg.classList.remove('hidden');
    }).catch(()=>showToast('Search failed'));
  }

  cBtn.addEventListener('click', runCompareSearch);
  cInput.addEventListener('keydown', e=>{ if(e.key==='Enter') runCompareSearch(); });
  cInput.addEventListener('input', ()=>{
    clearTimeout(compareTimer);
    const q = cInput.value.trim();
    if (!q) { cSugg.classList.add('hidden'); return; }
    compareTimer = setTimeout(async ()=>{
      const movies = await searchMovies(q).catch(()=>[]);
      if (!movies.length) { cSugg.classList.add('hidden'); return; }
      bindSuggestions(cSugg, movies, (id,m)=>addFilmToCompare(id,m));
    }, 280);
  });

  document.addEventListener('click', e=>{
    if (!e.target.closest('.home-search-wrap'))  suggestions.classList.add('hidden');
    if (!e.target.closest('.compare-search-row')) cSugg.classList.add('hidden');
  });
});
