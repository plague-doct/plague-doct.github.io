// ── Config ───────────────────────────────────────────────────────────────────
const TMDB_KEY   = 'f40d9966d6b39627111499fdb5a3e3e7';
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmNDBkOTk2NmQ2YjM5NjI3MTExNDk5ZmRiNWEzZTNlNyIsIm5iZiI6MTc3ODQ2NjA3My4zMzYsInN1YiI6IjZhMDEzZDE5MjZmOTljODlkNjI0MTlmYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.hJJIPICzHtPXvMkXhMC69sMrW1U3x21nDT5fXnjX1CY';
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

const CAT_WEIGHTS = {
  gore:1.4, demonic:1.3, slasher:1.2, supernatural:1.1,
  creature:1.0, occult:1.0, psychological:0.9, tension:0.7,
};

let userWeights = { ...CAT_WEIGHTS };
const CAT_LABELS = {
  gore:'Gore', supernatural:'Supernatural', psychological:'Psychological',
  slasher:'Slasher', demonic:'Demonic', creature:'Creature', tension:'Tension', occult:'Occult',
};

function calcScare(movie, keywords = [], rtScore = null, rebertScore = null, guardianScore = null, letterboxdScore = null) {
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

  let rawScore = 0;
  for (const [cat, val] of Object.entries(cats)) {
    rawScore += val * (userWeights[cat] ?? CAT_WEIGHTS[cat] ?? 1);
  }

  if (rtScore !== null)         rawScore += (rtScore / 100) * 3;
  if (rebertScore !== null)     rawScore += (rebertScore / 4) * 2;
  if (guardianScore !== null)   rawScore += (guardianScore / 5) * 1.5;
  if (letterboxdScore !== null) rawScore += (letterboxdScore / 5) * 1;

  let score = 1 + (rawScore / 15) * 4;
  score = Math.max(1, Math.min(5, Math.round(score)));
  return { score, cats };
}

const SCARE_ICONS = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAACJ0lEQVR4AcyUMbYTMQxF/VgCHQUlVbIQSpZKyULSUVLQsYXgK88bNB7b81Nw4J95liXLutL8JO/KP/p7FfysfV6pplw/bwUH7PF4FOv5fJaRKjJyq10+V+AoYpgr3e93b8NKCsviZuo+7lY7fFbgZwZmGMVztexLrQliqObRQDXHZwYOaE6lCftSKz7yN5iP4t9RnRN8Bq6588dNSK2BHja/+edkBN6nza+XKx8+fykWvoG/Pn4qFnFLOjR2mHoEjntAPVkE6vLz29e6tscgbIuU8v7Hd2/D0pjU4BFIyxTcQ30HOLKPBYjY9wLex/B78P6aOVwJOJoB+7tbA/vr7sGHfF73SIekzZFUpLO245NZgkevO8dut9tecJto99mMYsTREkwCoCxiMwHKmuURvwST9Df0f4H5QF1Nmf+/V7mSTinDifmf9vD8i3WqsgX4MUGbG0aSf6/D9zIEAwXuJKDs+d5iZ/J3OsP5sEnXE2sG7WGS9u9tf4Y/gYszNJyYA+RJ2XtaGsPnjSAmwpdaTU9NLMPxs5Zgw2y5CAzbyw0QN9yWWK8ROF63Ew31pI7PrHSeXIpYLL43AvssrIGe1H4cpkVqdT251PyUctjOwPvUBvpW7ztuYO9L0UAsPsPOwJwFfDRhH5NOdfMn/nxYq6/A9bhw6dRAP3WeVlKRtN9lM9IV2HeotDfAxJakAEnN1gvaVM38eSvYFVx0ZZ27tK+Cl8VeOfwNAAD//xcJzTIAAAAGSURBVAMARxAXTNZuIbcAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAACM0lEQVR4AcSUMbbUMAxF/VgCHQUl1cxCKFkqJQuZjpKCji0EX3levuLYzp+Cwz95li3JvpIzPx/Kf/p7FbzVOq9UU66f94ID9ng8irVtWxmpIiO32uVzBY5DDPNJ9/vd07CSwjK4mDqPvdUOnxV4y8AM4/B8Wl5LrQh8qOZRQDXHZwYOaE6lCK+ldvho/YQ5FK+jLk7wGbjmzh8XIbUCeth851tkBN67zdfLlk9fvxWLtYF/Pn8pFn5LOhR26HoEjn1A3Vk46vD7x/c6tscgbPOU8vHXT0/DUpjU4OFIwxTcQ70HOPIaCxAx7wW897Huwfs1E0R0noUPAUcZKKlIbyLPehawX3cPdl5YgDFJw8hHWBLmIOnsc8IS7KSZvd1us9ClfwkeveeRD8rzKpnuGvkcXIJJApSFbyZAWbM8/Jdgkv6FhuDZDygX8Mr7lc4/siGYq+3h+YuVC8hzPiYo+yT5e53dZQgGCtyZQJnzf4udyf/TGc47l6471gzawyTtH4s+xnoCFzE07JgAcqfM3S2FseZGEB2xltqZ7hpfhrPOWoINs2UjMGwvF4DfcFt8vUbguG4nGupO7Z9Z6dy5FL4YvG8Ediysge7U6wimQWrnunOprVPKYToD710b6F392n4D+7UUBcTgGHYGJhbwUYe9Tzqdm3/x52A9fQWu4cKmUwF917lbSUXSvpfJSFdg7+GkvQA6tiQFSGq2btBT1cyf94J9gg9dWecu7avg5WGvBP8CAAD//7t16nkAAAAGSURBVAMAwEUXTMyXQ24AAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAACeklEQVR4AcSUsY4TQQyG/dMgWjoKSqrkHZCoQIoESp2KPqmoU+QNiHiE1AikFBQIxDukgwZR0NEiqmV+b/45Z3Zm91Ldaf/xjO3xZ+/t3T27o59rwV3qc0opZfq5Ldhhu93OpP1+bzUlpOcmO/pMgb2IYKp0PB61dXs4HNxyUTNp73eTrT5j4C4CI2y1Wl0Ui2c1UTRwkc9DC+xQJkiLxUJbU3E54jk2wTgbSJbTJ3PztMA3GZWdmhCwhFWuDFw1cJ42vl7efPDlm0k8C/jv/UeT6JfUWG3qGtjvEarJ3JGWv8+eprV/BKLtPWb3ly+1dcvGBHdHWJrgCF0ulya9ePfWqNc/fpr05utno9brtUliEK59tCW4O51OGULYdru1+Xyepcu/P30w6uGv73IZgKzNZpObYDNd59+XL7xQgunLIjAfzpuajyEANBcChj4ljIKV1LKz2awVmvSPgvnaywo1H3POr5LbrJpPwVEwkyIo7hkrFUFxX+bxPAlmEoEU91MikJrKq4JbH1Asds3vFxh+ZFUwpyvhj56/MirCy/2fx0+Min4AVnsDVTChhKuAgPy7la9m9Tcd4YQC0xOjBS1BAPI/izLGcwMOxqjqxAxQmpR7TcvGeOYboTgRz0BfU1PTF+E8R42CBZPlRcJoS6kB+gWXpa9UDeyvW4mCalL5WxYYTg64zxfdq4EVcyugJtXZg2EB+rqaHOjPIeVi2wLnqQXUrfIsv4DlGfAGfFGMtgVmzOG1CUsfMKgbv/hhMFUfA6ew8dKggXLqOC0AA5DvclPTFFh3WCk3wIklAA4Cepsu4Kxk2s9twaqgomNWuaP2WvBosWuC/wEAAP//QtQR9gAAAAZJREFUAwDZ8xtMjOCW1QAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAACr0lEQVR4AcSUsYtTQRDG97ORaxQsBAtLGy//gDaClULAI3VAOeukshEkRRoLK4OdbUoRhRQWnnK9ZcBCG7EQLGxFLeJ+8/Ltzdu3771LdcfOzuzM7Pxm9pKcC2f0tyt4E/vsk5jSv04LNth8Pg+SxWIRShKRlht15+oDWxHBVGm1Wsk0vVwuTXNTM9G2u1EXVxd444EeNh6Pa8X8WU1kDdTyeWgDG5QJkuFwKDOouBz+7JtgnA1EzemjOllt4JOMgqUmBMxhhSsNVwmcpvXPy5t7H46DhGcB/7x+GyT0S9RYaeoS2O4RqsnMEbfft2/FvVoCUVeeEM6P7sk0zcYEN4fbWsEeOhqNguTui+eBcvj1W5A8+vg+UCaTSZCIQbhsr3PwZr1eJwhhs9ksDAaDJLr8492bQLn0/YtcAUCS6XSammAzm419vmzjhRxMXxIC02FrlHwMAaCqCdD0KaETrKQ2vb+/3xbq9XeC+ex5hZKPOdunpJmk5FOwE8wkD/I2Y7l4kLfzPJ57wUwaHfwMfVDmUQg8vP+XZqcUwf4DNHtyuVig7//78MG/dA9ofsiKYE7n4azw9MbncOXOAc1W+XX1WhhfeFWLAwh8hZozHopgQgmPcVt7R8em+b01o2XTd9r/mhEK9E+MHPry082wuPjYxPMApB8L71fus6Prye3gkLM4sYL+aTUtG2OcL0JhUZ6Bqqampo9PT12STrBg0ixAGHUuaoB+waXpy6UEtudWoqCaVP42DTQnB8xnm+6VwIqZFlCT6mxBtwFVXU0OVGeXUjPbwGlqAXUrP8svYH4GrAHbFKNuAzNm8NKEuQ9o1PWf+GYwVu8Cx3DgpUYD+dR+WgABQLpLoyR9YN1hpdQAJ5YAMBBQ6XgBW4mqfZ0WrAoq2qWV26l3BXcW2yX4HwAA//+WcEXYAAAABklEQVQDABAsJExZrm9oAAAAAElFTkSuQmCC',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAACiklEQVR4AcSToc5TQRCF52AIFodAotp3IEFB0gRSXYVvFbqib0DDI1QTSCoQBMI71IEhCByWoMqe2Z7b6d7de1v1N/fs7Mzs7Ddz296zO/rcCj6mPseUjow/14IdttlsTNput1ZTQvrZZAefMbBfIphu2u/32rrd7XZuuaiZtPfaZKvPEPgYgRG2WCwuLou+migauDhPpwV2KA9Is9lMW9PlCkQ/NsE8G0iW0ydzflrg84nKTk0IWMIqJb1QDdxNG18vKx98+WYSfQH/vf9oEuOSGqtNXQN7HaGazANp+fvsaVrzIxBtjpjdn7/U1i0bE9wDYWmCI3Q+n5v04t1bo17/+GnSm6+fjVoulyaJQbj20Zbg4+Fw6CCErdfreN6m06n7vz99MOrhr+/uA3CrZbVadU2wmePRf1++8EwJZuxCbEQwWvoXB04OLwYyHIDRP6WqZhTMKsJq0MlkwnQnwoBxKAuuAgtKy6KWgAwF8uStc4yPggnjxDxMS5/7UkCGMq7JuW9pFExYLC955QjTnrb0GYuqgltTxcLy+425cg/0X30VzKlK+KPnr4wqL43+n8dPjIox4PwVxHgVTCjhOigg/7eK1az+0xHOVw6MT4wWtAQBMCCrzNFvwMEcVZ2YCUqTcq9p2Rh9vhGKE9EH8p2amrEIpx81CBZMloWE0ZZSA4wLLstYqRrYX7cOCqpJFW9ZoD854DFfVFcDK+dWQE0q35NhAfK9mhzIfjhysW2Bu6kFVFXpKy5g6QPegC/K0bbAzDm8NmEZA3r3xl98P5luHwKntLGo10A5dZwWgAHoarmpaQysGt7UNcCJJQAOArJNBTgpmfZzLVg36NIhq7OD9lbw4GW3JP8DAAD//wpe5cgAAAAGSURBVAMA73YtTDdCebYAAAAASUVORK5CYII=',
];

const DESCRIPTORS = [
  { max:1, label:'Not that Scary',      icon:SCARE_ICONS[0], color:'#27ae60' },
  { max:2, label:'Bit Spooky',          icon:SCARE_ICONS[1], color:'#c87800' },
  { max:3, label:'In for a good scare', icon:SCARE_ICONS[2], color:'#e67e22' },
  { max:4, label:'Tough as nails',      icon:SCARE_ICONS[3], color:'#c00000' },
  { max:5, label:'Nightmare fuel',      icon:SCARE_ICONS[4], color:'#8e44ad' },
];

function scareImg(icon, cls = 'scare-icon') {
  return `<img src="${icon}" alt="" class="${cls}" />`;
}

function descriptor(score) { return DESCRIPTORS.find(d=>score<=d.max)||DESCRIPTORS[DESCRIPTORS.length-1]; }
function scareClass(score) { return `scare-${Math.max(1,Math.min(5,Math.round(score)))}`; }
function scareIcons(icon, score) { return Array(Math.max(0,Math.round(score))).fill(scareImg(icon,'scare-icon-sm')).join(''); }

// ── API helpers ───────────────────────────────────────────────────────────────

async function tmdb(path, params={}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const res = await fetch(url, { headers: tmdbHeaders });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function corsProxy(targetUrl, timeout = 7000) {
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(proxy, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    return res.text();
  } catch {
    clearTimeout(tid);
    return null;
  }
}

async function fetchRogerEbert(title, year) {
  try {
    const slug = title.toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const html = await corsProxy(`https://www.rogerebert.com/reviews/${slug}-${year}`);
    if (!html) return null;
    const m = html.match(/"ratingValue"\s*:\s*"?([0-4](?:\.[05])?)"/) ||
              html.match(/data-rating="([0-4](?:\.[05])?)"/) ||
              html.match(/class="[^"]*stars?-([0-9]+(?:-[05])?)"/ );
    if (!m) return null;
    return parseFloat(m[1].replace('-', '.'));
  } catch { return null; }
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

async function fetchGuardian(title, year) {
  try {
    const q = encodeURIComponent(`"${title}" review`);
    let apiUrl = `https://content.guardianapis.com/search?q=${q}&section=film&tag=film/film&api-key=test&show-fields=starRating`;
    if (year) {
      const y = parseInt(year);
      apiUrl += `&from-date=${y-1}-01-01&to-date=${y+1}-12-31`;
    }
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.response?.results || [];
    for (const r of results) {
      const stars = r.fields?.starRating;
      if (stars != null && stars !== '') return parseFloat(stars);
    }
    return null;
  } catch { return null; }
}

async function fetchLetterboxd(title, year) {
  try {
    const slug = title.toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const tryParse = html => {
      if (!html) return null;
      const ldMatch = html.match(/"aggregateRating"[^}]*"ratingValue"\s*:\s*"?([0-9.]+)/);
      if (ldMatch) return parseFloat(ldMatch[1]);
      const dataMatch = html.match(/data-average-rating="([0-9.]+)"/);
      if (dataMatch) return parseFloat(dataMatch[1]);
      return null;
    };

    const urls = [`https://letterboxd.com/film/${slug}/`];
    if (year) urls.push(`https://letterboxd.com/film/${slug}-${year}/`);

    const results = await Promise.all(urls.map(u => corsProxy(u, 6000)));
    for (const html of results) {
      const score = tryParse(html);
      if (score !== null) return score;
    }
    return null;
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

function renderCard(movie, score, cats) {
  const poster = posterUrl(movie.poster_path);
  const year   = (movie.release_date||'').slice(0,4);
  const desc   = descriptor(score);

  const topCats = Object.entries(cats)
    .filter(([,v]) => v > 0)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 5);

  const catRows = topCats.map(([cat, val]) => `
    <div class="card-cat-row">
      <span class="card-cat-name">${CAT_LABELS[cat]||cat}</span>
      <div class="card-cat-track"><div class="card-cat-fill" style="width:${(val/10)*100}%;background:${desc.color}"></div></div>
      <span class="card-cat-val">${val.toFixed(1)}</span>
    </div>`).join('');

  return `
    <div class="movie-card" data-id="${movie.id}">
      ${poster ? `<img class="card-poster" src="${poster}" alt="${esc(movie.title)}" loading="lazy" />`
               : `<div class="card-no-poster">🎬<span>No poster</span></div>`}
      <div class="card-info">
        <div class="card-title">${esc(movie.title)}</div>
        ${year ? `<div class="card-year">${year}</div>` : ''}
        <span class="scare-badge ${scareClass(score)}">${scareImg(desc.icon)} ${score}/5</span>
        ${topCats.length ? `<div class="card-cats">${catRows}</div>` : ''}
      </div>
    </div>`;
}

function renderDetail(movie, credits, keywords, breakdown, rtScore, rebertScore, guardianScore, letterboxdScore) {
  const { score, cats } = breakdown;
  const desc     = descriptor(score);
  const poster   = posterUrl(movie.poster_path, 'w500');
  const year     = (movie.release_date||'').slice(0,4);
  const runtime  = movie.runtime ? `${movie.runtime}m` : '';
  const rating   = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
  const director = (credits.crew||[]).find(c=>c.job==='Director');
  const genres   = (movie.genres||[]).map(g=>`<span class="genre-tag">${esc(g.name)}</span>`).join('');
  const cast     = (credits.cast||[]).slice(0,8).map(c=>`<span class="cast-chip">${esc(c.name)}</span>`).join('');

  const horrorTags = Object.entries(cats)
    .filter(([,v])=>v>=2).sort((a,b)=>b[1]-a[1])
    .map(([cat])=>`<span class="horror-tag horror-tag-${cat}">${CAT_LABELS[cat]||cat}</span>`)
    .join('');

  const kwTags = keywords.slice(0,10)
    .map(kw=>`<span class="keyword-tag">${esc(kw.name)}</span>`)
    .join('');

  const breakdownItems = Object.entries(cats)
    .filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
    .map(([cat,val])=>`
      <div class="breakdown-item">
        <div class="breakdown-name"><span>${CAT_LABELS[cat]||cat}</span><strong>${val.toFixed(1)}</strong></div>
        <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:${(val/10)*100}%;background:${desc.color}"></div></div>
      </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.84rem">No specific scare signals detected.</p>';

  const sourceChips = `
    <div class="source-chips-row">
      <div class="source-chip active" title="TMDB User Rating">
        <span class="source-chip-icon">⭐</span>
        <span class="source-chip-label">TMDB</span>
        <span class="source-chip-val">${rating}</span>
      </div>
      <div class="source-chip ${rtScore!==null?'active':'unavail'}" title="Rotten Tomatoes">
        <span class="source-chip-icon">🍅</span>
        <span class="source-chip-label">Tomatometer</span>
        <span class="source-chip-val">${rtScore!==null?rtScore+'%':'—'}</span>
      </div>
      <div class="source-chip ${rebertScore!==null?'active':'unavail'}" title="Roger Ebert">
        <span class="source-chip-icon">✒</span>
        <span class="source-chip-label">Roger Ebert</span>
        <span class="source-chip-val">${rebertScore!==null?rebertScore+'/4':'—'}</span>
      </div>
      <div class="source-chip ${guardianScore!==null?'active':'unavail'}" title="The Guardian">
        <span class="source-chip-icon">📰</span>
        <span class="source-chip-label">The Guardian</span>
        <span class="source-chip-val">${guardianScore!==null?guardianScore+'/5':'—'}</span>
      </div>
      <div class="source-chip ${letterboxdScore!==null?'active':'unavail'}" title="Letterboxd">
        <span class="source-chip-icon">📚</span>
        <span class="source-chip-label">Letterboxd</span>
        <span class="source-chip-val">${letterboxdScore!==null?letterboxdScore.toFixed(2)+'/5':'—'}</span>
      </div>
    </div>`;

  return `
    <div class="detail-layout">
      <div>
        ${poster ? `<img class="detail-poster" src="${poster}" alt="${esc(movie.title)}" />`
                 : `<div class="detail-no-poster">🎬</div>`}
        <div class="scare-meter-wrap">
          <div class="scare-label">Scare Factor</div>
          <div class="scare-score" style="color:${desc.color}">${score}</div>
          <div class="scare-descriptor" style="color:${desc.color}">${scareImg(desc.icon)} ${desc.label}</div>
          <div class="scare-bar-track">
            <div class="scare-bar-fill" style="width:${(score/5)*100}%;background:linear-gradient(90deg,${desc.color}aa,${desc.color})"></div>
          </div>
          <div class="scare-icons">${scareIcons(desc.icon, score)}</div>
        </div>
      </div>
      <div class="detail-info">
        <h2>${esc(movie.title)}</h2>
        <div class="detail-meta">
          ${year     ? `<span>${year}</span><span class="meta-dot">·</span>` : ''}
          ${runtime  ? `<span>${runtime}</span><span class="meta-dot">·</span>` : ''}
          ${director ? `<span>Dir. ${esc(director.name)}</span>` : ''}
        </div>

        ${sourceChips}

        ${horrorTags || kwTags ? `
          <div class="tags-section">
            <div class="tags-row">${horrorTags}${kwTags}</div>
          </div>` : ''}

        <div class="genre-tags">${genres}</div>
        ${movie.overview ? `<p class="detail-overview">${esc(movie.overview)}</p>` : ''}

        <div class="scare-breakdown">
          <h3>Scare breakdown</h3>
          <div class="breakdown-grid">${breakdownItems}</div>
        </div>

        ${cast ? `<div class="cast-section"><h3>Cast</h3><div class="cast-list">${cast}</div></div>` : ''}
      </div>
    </div>`;
}

// ── Compare state ─────────────────────────────────────────────────────────────

const compareList = [];
const MAX_COMPARE = 3;

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
    slots.innerHTML = '<div class="compare-empty-hint">Search above to add films — up to 3 at once</div>';
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
              <div class="compare-desc" style="color:${desc.color}">${scareImg(desc.icon)} ${desc.label}</div>
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
    chart.innerHTML = `<h3>Scare Ranking</h3>` + compareList
      .slice().sort((a,b)=>b.breakdown.score-a.breakdown.score)
      .map(({ movie, breakdown }) => {
        const { score } = breakdown;
        const desc = descriptor(score);
        return `
          <div class="chart-row">
            <span class="chart-label" title="${esc(movie.title)}">${esc(movie.title)}</span>
            <div class="chart-track"><div class="chart-fill" style="width:${(score/5)*100}%;background:${desc.color}"></div></div>
            <span class="chart-val" style="color:${desc.color}">${score}</span>
          </div>`;
      }).join('');

    requestAnimationFrame(()=>{
      chart.querySelectorAll('.chart-fill').forEach(el=>{
        const w=el.style.width; el.style.width='0';
        requestAnimationFrame(()=>{ el.style.width=w; });
      });
    });
  } else {
    chart.classList.add('hidden');
  }
}

// ── Suggestions ───────────────────────────────────────────────────────────────

function buildSuggestions(movies) {
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

const SECTIONS = ['homeSection','resultsSection','movieDetail','compareSection','calculatorSection','discoverSection','franchiseSection'];

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
    const breakdown = calcScare(movie, keywords);
    content.innerHTML = renderDetail(movie, credits, keywords, breakdown, null, null, null, null);
    animateBars();

    const year = (movie.release_date||'').slice(0,4);
    Promise.all([
      fetchRt(movie.title, year),
      fetchRogerEbert(movie.title, year),
      fetchGuardian(movie.title, year),
      fetchLetterboxd(movie.title, year),
    ]).then(([rtScore, rebertScore, guardianScore, letterboxdScore]) => {
      if (rtScore === null && rebertScore === null && guardianScore === null && letterboxdScore === null) return;
      if (!document.getElementById('detailContent')) return;
      const updated = calcScare(movie, keywords, rtScore, rebertScore, guardianScore, letterboxdScore);
      content.innerHTML = renderDetail(movie, credits, keywords, updated, rtScore, rebertScore, guardianScore, letterboxdScore);
      animateBars();
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
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:2rem 0">No films found.</p>';
      return;
    }
    grid.innerHTML = movies.map(m=>{ const { score, cats } = calcScare(m); return renderCard(m, score, cats); }).join('');
    grid.querySelectorAll('.movie-card').forEach(c=>{
      c.addEventListener('click',()=>openMovie(+c.dataset.id,'resultsSection'));
    });
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--accent);grid-column:1/-1;padding:2rem 0">Error fetching results.</p>';
  }
}

// ── Compare search ────────────────────────────────────────────────────────────

let compareTimer = null;

async function addFilmToCompare(id) {
  document.getElementById('compareSearchInput').value = '';
  document.getElementById('compareSuggestions').classList.add('hidden');

  if (compareList.some(e=>e.movie.id===id)) { showToast('Already in compare'); return; }
  if (compareList.length >= MAX_COMPARE)     { showToast(`Max ${MAX_COMPARE} films`); return; }

  try {
    const { movie, keywords } = await getDetails(id);
    const breakdown = calcScare(movie, keywords);
    addToCompare(movie, breakdown);

    const year = (movie.release_date||'').slice(0,4);
    Promise.all([
      fetchRt(movie.title, year),
      fetchRogerEbert(movie.title, year),
      fetchGuardian(movie.title, year),
      fetchLetterboxd(movie.title, year),
    ]).then(([rtScore, rebertScore, guardianScore, letterboxdScore]) => {
      if (rtScore === null && rebertScore === null && guardianScore === null && letterboxdScore === null) return;
      const entry = compareList.find(e=>e.movie.id===id);
      if (!entry) return;
      entry.breakdown = calcScare(movie, keywords, rtScore, rebertScore, guardianScore, letterboxdScore);
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

// ── Recent films ──────────────────────────────────────────────────────────────

let recentMovies = [];
let rerenderTimer = null;

function rerenderRecent() {
  if (!recentMovies.length) return;
  const list = document.getElementById('recentList');
  if (!list) return;
  list.innerHTML = recentMovies.map(m => {
    const { score, cats } = calcScare(m);
    return renderCard(m, score, cats);
  }).join('');
  list.querySelectorAll('.movie-card').forEach(c => {
    c.addEventListener('click', () => openMovie(+c.dataset.id, 'homeSection'));
  });
  list.classList.remove('cards-recalculating');
}

function scheduleRerender() {
  const list = document.getElementById('recentList');
  if (list && recentMovies.length) list.classList.add('cards-recalculating');
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(rerenderRecent, 350);
}

async function loadRecent() {
  const list = document.getElementById('recentList');
  if (!list) return;
  try {
    const data = await tmdb('/discover/movie', {
      with_genres: HORROR_ID,
      sort_by: 'popularity.desc',
      'vote_count.gte': 50,
      page: 1,
    });
    recentMovies = (data.results || []).slice(0, 20);
    if (!recentMovies.length) { list.innerHTML = '<div class="sidebar-loading">None found</div>'; return; }
    list.innerHTML = recentMovies.map(m => {
      const { score, cats } = calcScare(m);
      return renderCard(m, score, cats);
    }).join('');
    list.querySelectorAll('.movie-card').forEach(c => {
      c.addEventListener('click', () => openMovie(+c.dataset.id, 'homeSection'));
    });
  } catch {
    list.innerHTML = '<div class="sidebar-loading">Unavailable</div>';
  }
}

// ── Scare Calculator ──────────────────────────────────────────────────────────

const HEREDITARY_ID = 493922;
let hereditaryCats  = null;
let calcInitialized = false;

function renderExampleCard(movie, loading = false) {
  const wrap   = document.getElementById('calcExampleWrap');
  if (!wrap) return;
  const poster = posterUrl(movie.poster_path, 'w185');
  const year   = (movie.release_date || '').slice(0, 4);
  wrap.innerHTML = `
    <div class="calc-example-card">
      ${poster ? `<img class="calc-example-poster" src="${poster}" alt="${esc(movie.title)}" />`
               : `<div class="calc-example-poster-empty">🎬</div>`}
      <div class="calc-example-info">
        <div class="calc-example-eyebrow">Live Example</div>
        <div class="calc-example-title">${esc(movie.title)}${year ? ` <span class="calc-example-year">(${year})</span>` : ''}</div>
        <div class="calc-example-score-row">
          <div class="calc-example-score" id="calcExScore">${loading ? '…' : '—'}</div>
          <div class="calc-example-desc"  id="calcExDesc">${loading ? 'Loading…' : '—'}</div>
        </div>
        <div class="calc-example-bar-track">
          <div class="calc-example-bar-fill" id="calcExBar" style="width:0%"></div>
        </div>
        <div class="calc-example-note">Adjust the sliders to see how the score changes</div>
      </div>
    </div>`;
}

function fillSliders(cats) {
  Object.entries(cats).forEach(([cat, val]) => {
    const slider = document.querySelector(`.calc-slider[data-cat="${cat}"]`);
    const valEl  = document.getElementById(`calcVal-${cat}`);
    if (slider) slider.value = val;
    if (valEl)  valEl.textContent = parseFloat(val).toFixed(1);
  });
}

function renderWeightsPanel(hereditaryCatsData) {
  const weightsEl = document.getElementById('calcWeightsList');
  if (!weightsEl) return;
  if (!hereditaryCatsData) {
    weightsEl.innerHTML = '<div class="calc-example-loading">Loading…</div>';
    return;
  }
  weightsEl.innerHTML = Object.entries(CAT_WEIGHTS)
    .sort((a,b) => b[1] - a[1])
    .map(([cat]) => {
      const intensity = hereditaryCatsData[cat] || 0;
      return `
        <div class="calc-weight-row">
          <span class="calc-weight-name">${CAT_LABELS[cat] || cat}</span>
          <div class="calc-weight-bar-track">
            <div class="calc-weight-bar-fill" style="width:${(intensity / 10) * 100}%"></div>
          </div>
          <span class="calc-weight-val">${intensity.toFixed(1)}</span>
        </div>`;
    }).join('');
}

function initCalculator() {
  if (calcInitialized) return;
  calcInitialized = true;

  const slidersEl = document.getElementById('calcSliders');

  slidersEl.innerHTML = Object.entries(CAT_LABELS).map(([cat, label]) => {
    const def = CAT_WEIGHTS[cat] ?? 1.0;
    return `
      <div class="calc-slider-row">
        <div class="calc-slider-header">
          <span class="calc-slider-label">${label}</span>
          <span class="calc-slider-val" id="calcVal-${cat}">×${def.toFixed(1)}</span>
        </div>
        <input type="range" class="calc-slider" data-cat="${cat}" min="0" max="3" step="0.1" value="${def}" />
      </div>`;
  }).join('');

  slidersEl.querySelectorAll('.calc-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      document.getElementById(`calcVal-${slider.dataset.cat}`).textContent = `×${parseFloat(slider.value).toFixed(1)}`;
      updateCalcScore();
    });
  });

  renderWeightsPanel(null);
  updateCalcScore();

  document.getElementById('calcResetBtn').addEventListener('click', () => {
    document.querySelectorAll('.calc-slider').forEach(s => {
      const def = CAT_WEIGHTS[s.dataset.cat] ?? 1.0;
      s.value = def;
      document.getElementById(`calcVal-${s.dataset.cat}`).textContent = `×${def.toFixed(1)}`;
    });
    updateCalcScore();
  });

  const wrap = document.getElementById('calcExampleWrap');
  if (wrap) wrap.innerHTML = '<div class="calc-example-loading">Loading example film…</div>';

  getDetails(HEREDITARY_ID).then(({ movie, keywords }) => {
    const { cats } = calcScare(movie, keywords);
    hereditaryCats = cats;
    renderExampleCard(movie, false);
    renderWeightsPanel(cats);
    updateCalcScore();
  }).catch(() => {
    if (wrap) wrap.innerHTML = '';
    renderWeightsPanel({});
  });
}

function updateCalcScore() {
  const baseCats = hereditaryCats || Object.fromEntries(Object.keys(CAT_WEIGHTS).map(k => [k, 5]));
  let rawScore = 0;
  document.querySelectorAll('.calc-slider').forEach(s => {
    const w = parseFloat(s.value);
    userWeights[s.dataset.cat] = w;
    rawScore += (baseCats[s.dataset.cat] || 0) * w;
  });
  scheduleRerender();
  const exact = Math.max(1, Math.min(5, 1 + (rawScore / 15) * 4));
  const rounded = Math.round(exact);
  const desc = descriptor(rounded);

  const scoreEl = document.getElementById('calcScore');
  const descEl  = document.getElementById('calcDesc');
  const barEl   = document.getElementById('calcBarFill');

  if (scoreEl) { scoreEl.textContent = exact.toFixed(1); scoreEl.style.color = desc.color; }
  if (descEl)  { descEl.innerHTML = `${scareImg(desc.icon)} ${desc.label}`; descEl.style.color = desc.color; }
  if (barEl)   { barEl.style.width = `${(exact/5)*100}%`; barEl.style.background = desc.color; }

  const exScore = document.getElementById('calcExScore');
  const exDesc  = document.getElementById('calcExDesc');
  const exBar   = document.getElementById('calcExBar');
  if (exScore) { exScore.textContent = exact.toFixed(1); exScore.style.color = desc.color; }
  if (exDesc)  { exDesc.innerHTML = `${scareImg(desc.icon)} ${desc.label}`; exDesc.style.color = desc.color; }
  if (exBar)   { exBar.style.width = `${(exact/5)*100}%`; exBar.style.background = desc.color; }
}

// ── Discover ──────────────────────────────────────────────────────────────────

let discoverFilm1 = null;
let discoverFilm2 = null;
let discoverFactor = 'similar';
let discoverCandidates = [];
let discoverIdx = 0;

function setDiscoverFilm(num, movie) {
  if (num === 1) {
    discoverFilm1 = movie;
    document.getElementById('discoverInput1').value = movie.title;
    document.getElementById('discoverSugg1').classList.add('hidden');
  } else {
    discoverFilm2 = movie;
    document.getElementById('discoverInput2').value = movie.title;
    document.getElementById('discoverSugg2').classList.add('hidden');
  }
}

async function runDiscover() {
  if (!discoverFilm1 || !discoverFilm2) { showToast('Pick two films first'); return; }

  const btn = document.getElementById('discoverGoBtn');
  const resultEl = document.getElementById('discoverResult');
  btn.textContent = 'Searching…';
  btn.disabled = true;
  resultEl.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  resultEl.classList.remove('hidden');

  try {
    const [rec1, rec2, sim1, sim2] = await Promise.all([
      tmdb(`/movie/${discoverFilm1.id}/recommendations`).then(d=>d.results||[]).catch(()=>[]),
      tmdb(`/movie/${discoverFilm2.id}/recommendations`).then(d=>d.results||[]).catch(()=>[]),
      tmdb(`/movie/${discoverFilm1.id}/similar`).then(d=>d.results||[]).catch(()=>[]),
      tmdb(`/movie/${discoverFilm2.id}/similar`).then(d=>d.results||[]).catch(()=>[]),
    ]);

    const inputIds = new Set([discoverFilm1.id, discoverFilm2.id]);
    const pool = new Map();

    const addCandidate = (movie, weight) => {
      if (!movie || !(movie.genre_ids||[]).includes(HORROR_ID)) return;
      if (inputIds.has(movie.id)) return;
      if (!pool.has(movie.id)) pool.set(movie.id, { movie, overlap: 0 });
      pool.get(movie.id).overlap += weight;
    };

    rec1.forEach(m => addCandidate(m, 2));
    rec2.forEach(m => addCandidate(m, 2));
    sim1.forEach(m => addCandidate(m, 1));
    sim2.forEach(m => addCandidate(m, 1));

    const avgInputScore = [calcScare(discoverFilm1).score, calcScare(discoverFilm2).score]
      .reduce((a,b)=>a+b,0) / 2;

    const candidates = Array.from(pool.values()).map(({ movie, overlap }) => {
      const { score, cats } = calcScare(movie);
      return { movie, score, cats, overlap };
    });

    candidates.sort((a, b) => {
      switch (discoverFactor) {
        case 'similar': {
          const aS = a.overlap * 2 - Math.abs(a.score - avgInputScore);
          const bS = b.overlap * 2 - Math.abs(b.score - avgInputScore);
          return bS - aS;
        }
        case 'scarier':       return b.score - a.score;
        case 'lighter':       return a.score - b.score;
        case 'gore':          return b.cats.gore - a.cats.gore;
        case 'psychological': return b.cats.psychological - a.cats.psychological;
        case 'supernatural':  return b.cats.supernatural - a.cats.supernatural;
        default:              return b.overlap - a.overlap;
      }
    });

    discoverCandidates = candidates;
    discoverIdx = 0;

    if (!candidates.length) {
      resultEl.innerHTML = '<p style="color:var(--text-muted);padding:2rem;text-align:center">No recommendations found — try different films.</p>';
    } else {
      renderDiscoverResult();
    }
  } catch(e) {
    resultEl.innerHTML = '<p style="color:var(--red);padding:2rem;text-align:center">Error fetching recommendations.</p>';
    console.error(e);
  } finally {
    btn.textContent = 'Find My Film →';
    btn.disabled = false;
  }
}

function renderDiscoverResult() {
  const resultEl = document.getElementById('discoverResult');
  if (!discoverCandidates.length) return;

  const { movie, score } = discoverCandidates[discoverIdx];
  const desc   = descriptor(score);
  const poster = posterUrl(movie.poster_path, 'w342');
  const year   = (movie.release_date||'').slice(0,4);
  const total  = Math.min(discoverCandidates.length, 10);

  resultEl.innerHTML = `
    <div class="discover-result-header">
      <span class="discover-result-label">Recommended for you</span>
      <span class="discover-result-count">${discoverIdx+1} / ${total}</span>
    </div>
    <div class="discover-result-card">
      ${poster ? `<img class="discover-result-poster" src="${poster}" alt="${esc(movie.title)}" />`
               : `<div class="discover-result-no-poster">🎬</div>`}
      <div class="discover-result-info">
        <div class="discover-result-title">${esc(movie.title)}</div>
        ${year ? `<div class="discover-result-year">${year}</div>` : ''}
        <span class="scare-badge ${scareClass(score)}">${scareImg(desc.icon)} ${score}/5 — ${desc.label}</span>
        ${movie.overview ? `<p class="discover-result-overview">${esc(movie.overview.slice(0,220))}${movie.overview.length>220?'…':''}</p>` : ''}
        <div class="discover-result-btns">
          <button class="discover-open-btn" id="discoverOpenBtn">View Film →</button>
          ${discoverIdx < total-1 ? `<button class="discover-refresh-btn" id="discoverNextBtn">↻ Try another</button>` : ''}
        </div>
      </div>
    </div>`;

  resultEl.classList.remove('hidden');

  document.getElementById('discoverOpenBtn')?.addEventListener('click', () => {
    openMovie(movie.id, 'discoverSection');
  });
  document.getElementById('discoverNextBtn')?.addEventListener('click', () => {
    discoverIdx = Math.min(discoverIdx + 1, total - 1);
    renderDiscoverResult();
  });
}

// ── Franchise Library ────────────────────────────────────────────────────────

const FRANCHISES = [
  { name: 'Texas Chain Saw',         collectionId: 111751 }, // 1974
  { name: 'Halloween',               collectionId: 91361  }, // 1978
  { name: 'Friday the 13th',         collectionId: 9735   }, // 1980
  { name: 'Evil Dead',               collectionId: 1960   }, // 1981
  { name: 'A Nightmare on Elm St.',  collectionId: 8581   }, // 1984
  { name: 'Hellraiser',              collectionId: 8917   }, // 1987
  { name: "Child's Play",            collectionId: 10455  }, // 1988
  { name: 'Scream',                  collectionId: 2602   }, // 1996
  { name: 'Final Destination',       collectionId: 8864   }, // 2000
  { name: 'Saw',                     collectionId: 656    }, // 2004
  { name: 'Paranormal Activity',     collectionId: 41437  }, // 2007
  { name: 'Insidious',               collectionId: 228446 }, // 2010
  { name: 'The Conjuring',           collectionId: 313086 }, // 2013
  { name: 'The Purge',               collectionId: 256322 }, // 2013
];

async function loadFranchiseLibrary() {
  const content = document.getElementById('franchiseContent');
  const titleEl = document.getElementById('franchiseSectionTitle');
  titleEl.textContent = 'Franchise Library';

  content.innerHTML = `<div class="franchise-library-grid">${
    FRANCHISES.map((f, i) => `
      <div class="franchise-tile" id="ftile-${i}" data-collection="${f.collectionId}">
        <div class="franchise-tile-img-wrap">
          <div class="franchise-tile-placeholder"></div>
        </div>
        <div class="franchise-tile-body">
          <div class="franchise-tile-name">${esc(f.name)}</div>
          <div class="franchise-tile-meta" id="ftile-meta-${i}">Loading…</div>
        </div>
      </div>`).join('')
  }</div>`;

  content.querySelectorAll('.franchise-tile').forEach(tile => {
    tile.addEventListener('click', () => openFranchise(+tile.dataset.collection));
  });

  FRANCHISES.forEach(async (f, i) => {
    try {
      const col = await tmdb(`/collection/${f.collectionId}`);
      const parts = (col.parts || []).filter(p => p.release_date);
      const scores = parts.map(p => calcScare(p).score);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const desc = descriptor(Math.max(1, Math.min(5, Math.round(avg))));

      const tile = document.getElementById(`ftile-${i}`);
      if (!tile) return;

      const imgWrap = tile.querySelector('.franchise-tile-img-wrap');
      imgWrap.innerHTML = col.poster_path
        ? `<img class="franchise-tile-poster" src="${posterUrl(col.poster_path, 'w342')}" alt="${esc(f.name)}" />`
        : `<div class="franchise-tile-no-poster">🎬</div>`;

      const meta = document.getElementById(`ftile-meta-${i}`);
      if (meta) meta.innerHTML = `
        <span class="ftile-count">${parts.length} films</span>
        <span class="ftile-score" style="color:${desc.color}">${scareImg(desc.icon)} ${avg.toFixed(1)}</span>`;
    } catch {
      const meta = document.getElementById(`ftile-meta-${i}`);
      if (meta) meta.textContent = 'Unavailable';
    }
  });
}

async function openFranchise(collectionId) {
  const content = document.getElementById('franchiseContent');
  const titleEl = document.getElementById('franchiseSectionTitle');
  content.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  try {
    const col = await tmdb(`/collection/${collectionId}`);
    const franchise = FRANCHISES.find(f => f.collectionId === collectionId);
    titleEl.textContent = franchise ? franchise.name : col.name;

    const parts = (col.parts || [])
      .filter(p => p.release_date)
      .sort((a, b) => a.release_date.localeCompare(b.release_date));

    const scored = parts
      .map(p => ({ movie: p, ...calcScare(p) }))
      .sort((a, b) => (a.movie.release_date || '').localeCompare(b.movie.release_date || ''));

    const avg = scored.length ? scored.reduce((s, e) => s + e.score, 0) / scored.length : 0;
    const avgDesc = descriptor(Math.max(1, Math.min(5, Math.round(avg))));

    const rows = scored.map((entry, i) => {
      const { movie, score, cats } = entry;
      const desc = descriptor(score);
      const poster = posterUrl(movie.poster_path, 'w185');
      const year = (movie.release_date || '').slice(0, 4);

      const topCats = Object.entries(cats)
        .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([cat, val]) => `
          <div class="fr-cat-row">
            <span class="fr-cat-name">${CAT_LABELS[cat] || cat}</span>
            <div class="fr-cat-track"><div class="fr-cat-fill" style="width:${(val/10)*100}%;background:${desc.color}"></div></div>
            <span class="fr-cat-val">${val.toFixed(1)}</span>
          </div>`).join('');

      return `
        <div class="franchise-film-row" data-id="${movie.id}">
          <div class="fr-rank" style="color:${desc.color}">#${i + 1}</div>
          ${poster
            ? `<img class="fr-poster" src="${poster}" alt="${esc(movie.title)}" />`
            : `<div class="fr-no-poster">🎬</div>`}
          <div class="fr-info">
            <div class="fr-title">${esc(movie.title)}${year ? ` <span class="fr-year">(${year})</span>` : ''}</div>
            <div class="fr-score-row">
              ${scareImg(desc.icon)}
              <span class="fr-score" style="color:${desc.color}">${score}/5</span>
              <span class="fr-desc-label" style="color:${desc.color}">${desc.label}</span>
            </div>
            ${topCats ? `<div class="fr-cats">${topCats}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    content.innerHTML = `
      <button class="back-btn fr-back" id="frBackToLib">← All Franchises</button>
      <div class="fr-summary">
        ${scareImg(avgDesc.icon)} Franchise avg
        <strong style="color:${avgDesc.color}">${avg.toFixed(1)}/5</strong>
        <span class="fr-film-count">· ${parts.length} films</span>
      </div>
      <div class="franchise-films-list">${rows}</div>`;

    document.getElementById('frBackToLib').addEventListener('click', loadFranchiseLibrary);
    content.querySelectorAll('.franchise-film-row').forEach(row => {
      row.addEventListener('click', () => openMovie(+row.dataset.id, 'franchiseSection'));
    });

  } catch (e) {
    content.innerHTML = '<p style="color:var(--text-muted);padding:2rem">Failed to load franchise.</p>';
    console.error(e);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadRecent();

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
      bindSuggestions(suggestions, movies, (id)=>openMovie(id,'homeSection'));
    }, 280);
  });

  document.getElementById('resultsBackBtn').addEventListener('click', ()=>{
    showSection('homeSection'); window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('backBtn').addEventListener('click', ()=>{
    showSection(detailBackTarget); window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('compareLaunchBtn').addEventListener('click', ()=>{
    showSection('compareSection'); window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('compareBackBtn').addEventListener('click', ()=>{
    showSection('homeSection'); window.scrollTo({top:0,behavior:'smooth'});
  });

  const cInput = document.getElementById('compareSearchInput');
  const cBtn   = document.getElementById('compareSearchBtn');
  const cSugg  = document.getElementById('compareSuggestions');

  function runCompareSearch() {
    const q = cInput.value.trim();
    if (!q) return;
    cSugg.classList.add('hidden');
    searchMovies(q).then(movies=>{
      if (!movies.length) { showToast('No films found'); return; }
      bindSuggestions(cSugg, movies, (id)=>addFilmToCompare(id));
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
      bindSuggestions(cSugg, movies, (id)=>addFilmToCompare(id));
    }, 280);
  });

  document.getElementById('scareAlgoBtn').addEventListener('click', ()=>{
    showSection('calculatorSection');
    initCalculator();
    window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('calcBackBtn').addEventListener('click', ()=>{
    showSection('homeSection'); window.scrollTo({top:0,behavior:'smooth'});
    rerenderRecent();
  });

  document.getElementById('discoverBtn').addEventListener('click', ()=>{
    showSection('discoverSection'); window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('discoverBackBtn').addEventListener('click', ()=>{
    showSection('homeSection'); window.scrollTo({top:0,behavior:'smooth'});
  });

  document.getElementById('franchiseBtn').addEventListener('click', ()=>{
    showSection('franchiseSection'); window.scrollTo({top:0,behavior:'smooth'});
    loadFranchiseLibrary();
  });

  document.getElementById('franchiseBackBtn').addEventListener('click', ()=>{
    showSection('homeSection'); window.scrollTo({top:0,behavior:'smooth'});
  });

  function bindDiscoverInput(num, inputId, suggId) {
    const input = document.getElementById(inputId);
    const sugg  = document.getElementById(suggId);
    let timer   = null;

    input.addEventListener('input', ()=>{
      clearTimeout(timer);
      const q = input.value.trim();
      if (!q) { sugg.classList.add('hidden'); return; }
      timer = setTimeout(async ()=>{
        const movies = await searchMovies(q).catch(()=>[]);
        if (!movies.length) { sugg.classList.add('hidden'); return; }
        bindSuggestions(sugg, movies, (id, m)=>setDiscoverFilm(num, m));
      }, 280);
    });
    input.addEventListener('keydown', e=>{
      if (e.key==='Escape') sugg.classList.add('hidden');
    });
  }

  bindDiscoverInput(1, 'discoverInput1', 'discoverSugg1');
  bindDiscoverInput(2, 'discoverInput2', 'discoverSugg2');

  document.getElementById('factorPills').addEventListener('click', e=>{
    const pill = e.target.closest('.factor-pill');
    if (!pill) return;
    document.querySelectorAll('.factor-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    discoverFactor = pill.dataset.factor;
  });

  document.getElementById('discoverGoBtn').addEventListener('click', runDiscover);

  document.addEventListener('click', e=>{
    if (!e.target.closest('.home-search-wrap'))   suggestions.classList.add('hidden');
    if (!e.target.closest('.compare-search-row')) cSugg.classList.add('hidden');
    if (!e.target.closest('#discoverInner1'))     document.getElementById('discoverSugg1').classList.add('hidden');
    if (!e.target.closest('#discoverInner2'))     document.getElementById('discoverSugg2').classList.add('hidden');
  });
});
