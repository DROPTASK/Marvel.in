/**
 * Marvel India — app shell.
 * Tiny hash-router SPA. No build step, no framework: just fetch + template
 * strings, so the whole thing runs by opening index.html.
 */
const app = document.getElementById("app");

// ---------------------------------------------------------------- helpers
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function fmtDate(d) { if (!d) return "TBA"; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }); }
function keyFor(type, id) { return `${type}:${id}`; }
function currentUser() { return MI_AUTH.currentUser(); }

function updateAuthHeader() {
  const slot = document.getElementById("auth-slot");
  const user = currentUser();
  slot.innerHTML = user
    ? `<span class="hello">Hey, ${user}</span>
       <a href="#/wishlist" class="pill">Wishlist</a>
       <button class="pill ghost" id="logout-btn">Log out</button>`
    : `<button class="pill" id="open-auth">Sign up / Log in</button>`;
  if (user) document.getElementById("logout-btn").onclick = () => { MI_AUTH.logout(); updateAuthHeader(); route(); };
  else document.getElementById("open-auth").onclick = openAuthModal;
}

function openAuthModal() {
  document.getElementById("modal-root").innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal comic-panel">
        <button class="modal-close" id="modal-close">&times;</button>
        <div class="tabs">
          <button class="tab active" data-tab="login">Log in</button>
          <button class="tab" data-tab="signup">Sign up</button>
        </div>
        <form id="auth-form">
          <label>Username <input name="username" required autocomplete="username"></label>
          <label>Password <input name="password" type="password" required autocomplete="current-password"></label>
          <p class="form-error" id="auth-error"></p>
          <button type="submit" class="pill primary full">Log in</button>
        </form>
        <p class="fine-print">Demo accounts live only in this browser (localStorage) — no server, no email required.</p>
      </div>
    </div>`;
  let mode = "login";
  const form = document.getElementById("auth-form");
  const submitBtn = form.querySelector("button[type=submit]");
  document.querySelectorAll(".tab").forEach(tabBtn => tabBtn.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    tabBtn.classList.add("active");
    mode = tabBtn.dataset.tab;
    submitBtn.textContent = mode === "login" ? "Log in" : "Create account";
  });
  document.getElementById("modal-close").onclick = closeModal;
  document.getElementById("modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const result = mode === "login"
      ? MI_AUTH.login(fd.get("username"), fd.get("password"))
      : MI_AUTH.signup(fd.get("username"), fd.get("password"));
    if (!result.ok) { document.getElementById("auth-error").textContent = result.error; return; }
    closeModal(); updateAuthHeader(); route();
  };
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

function posterCard(item) {
  const poster = item.poster || "assets/placeholder-poster.svg";
  return `
    <a class="card comic-panel" href="#/movie/${item.id}">
      <div class="card-poster" style="background-image:url('${poster}')"></div>
      <div class="card-body">
        <h3>${item.title}</h3>
        <span class="muted">${item.year || ""}</span>
      </div>
    </a>`;
}

// ---------------------------------------------------------------- HOME
async function renderHome() {
  app.innerHTML = `<div class="loading">Assembling the roster…</div>`;
  const doom = window.MI_ROADMAP.find(r => r.spotlight) || window.MI_ROADMAP[window.MI_ROADMAP.length - 2];
  let doomData = null;
  if (MI_API.tmdb.ready()) doomData = await MI_API.tmdb.findByTitle(doom.tmdbQuery);

  const doomPoster = doomData ? MI_API.tmdb.posterUrl(doomData.poster_path) : "assets/placeholder-poster.svg";
  const doomBackdrop = doomData ? MI_API.tmdb.backdropUrl(doomData.backdrop_path) : null;
  const doomOverview = (doomData && doomData.overview) || doom.synopsisFallback;
  const doomRelease = doomData ? fmtDate(doomData.release_date) : "December 18, 2026";

  let grid = [];
  if (MI_API.tmdb.ready()) {
    const disc = await MI_API.tmdb.discoverMarvel(1);
    if (disc && disc.results) {
      grid = disc.results.slice(0, 12).map(m => ({
        id: m.id, title: m.title, year: (m.release_date || "").slice(0, 4), poster: MI_API.tmdb.posterUrl(m.poster_path)
      }));
    }
  }
  if (!grid.length) {
    grid = window.MI_ROADMAP.slice(-12).map((m, i) => ({ id: "sample-" + i, title: m.title, year: m.year, poster: null }));
  }

  app.innerHTML = `
    <section class="hero" style="${doomBackdrop ? `--hero-bg:url('${doomBackdrop}')` : ""}">
      <div class="hero-inner comic-panel">
        <div class="hero-copy">
          <p class="kicker">The Doomsday Clock is ticking</p>
          <h1>Avengers: Doomsday</h1>
          <p class="hero-date">In cinemas ${doomRelease}</p>
          <p class="hero-overview">${doomOverview}</p>
          <div class="hero-cta">
            <a href="#/movie/${doomData ? doomData.id : "sample-doom"}" class="pill primary">Full details</a>
            <a href="#/roadmap" class="pill ghost">See the full roadmap</a>
          </div>
        </div>
        <div class="hero-poster"><img src="${doomPoster}" alt="Avengers: Doomsday poster" onerror="this.src='assets/placeholder-poster.svg'"></div>
      </div>
      <div id="doom-countdown" class="countdown"></div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Marvel, freshly reeled in</h2>
        <a href="#/search" class="link">Search everything →</a>
      </div>
      <div class="grid">${grid.map(posterCard).join("")}</div>
      ${!MI_API.tmdb.ready() ? `<p class="notice">Add a free TMDB key in js/config.js to pull live posters, ratings and cast here — showing bundled sample titles for now.</p>` : ""}
    </section>

    <section class="section quicklinks">
      <a class="quick comic-panel" href="#/timeline"><h3>MCU Timeline</h3><p>The story in chronological order, movie by movie.</p></a>
      <a class="quick comic-panel" href="#/characters"><h3>Character Database</h3><p>Every hero, actor, and power set.</p></a>
      <a class="quick comic-panel" href="#/roadmap"><h3>Movie Roadmap</h3><p>A checklist of the whole MCU slate.</p></a>
    </section>
  `;
  startCountdown(doomData ? doomData.release_date : "2026-12-18");
}

function startCountdown(targetDateStr) {
  const box = document.getElementById("doom-countdown");
  if (!box) return;
  const target = new Date(targetDateStr).getTime();
  function tick() {
    const diff = target - Date.now();
    if (isNaN(target) || diff <= 0) { box.innerHTML = `<span class="countdown-live">Doomsday is here.</span>`; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    box.innerHTML = `
      <span class="clock-label">Doomsday Clock</span>
      <div class="clock-units">
        <div><strong>${d}</strong><small>days</small></div>
        <div><strong>${String(h).padStart(2, "0")}</strong><small>hrs</small></div>
        <div><strong>${String(m).padStart(2, "0")}</strong><small>min</small></div>
        <div><strong>${String(s).padStart(2, "0")}</strong><small>sec</small></div>
      </div>`;
  }
  tick();
  if (window._doomInterval) clearInterval(window._doomInterval);
  window._doomInterval = setInterval(tick, 1000);
}

// ---------------------------------------------------------------- SEARCH
async function renderSearch(query) {
  app.innerHTML = `
    <section class="section">
      <h1>Search Marvel &amp; beyond</h1>
      <form id="search-form" class="search-form">
        <input name="q" placeholder="Search movies, shows, actors…" value="${query ? query.replace(/"/g, "&quot;") : ""}" autofocus>
        <button class="pill primary" type="submit">Search</button>
      </form>
      <div id="search-results">${query ? `<div class="loading">Searching…</div>` : `<p class="muted">Try “Spider-Man”, “Loki”, or “Doctor Strange”.</p>`}</div>
      ${!MI_API.tmdb.ready() ? `<p class="notice">Live search needs a free TMDB key in js/config.js.</p>` : ""}
    </section>`;
  document.getElementById("search-form").onsubmit = (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get("q");
    location.hash = `#/search?q=${encodeURIComponent(q)}`;
  };
  if (!query || !MI_API.tmdb.ready()) return;
  const data = await MI_API.tmdb.search(query);
  const results = (data && data.results || []).filter(r => r.media_type === "movie" || r.media_type === "tv");
  const box = document.getElementById("search-results");
  if (!results.length) { box.innerHTML = `<p class="muted">No results for “${query}”.</p>`; return; }
  box.innerHTML = `<div class="grid">${results.map(r => posterCard({
    id: r.id, title: r.title || r.name, year: (r.release_date || r.first_air_date || "").slice(0, 4),
    poster: MI_API.tmdb.posterUrl(r.poster_path)
  })).join("")}</div>`;
}

// ---------------------------------------------------------------- MOVIE DETAIL
async function renderMovie(id) {
  app.innerHTML = `<div class="loading">Pulling up the file…</div>`;
  let movie = null;
  if (MI_API.tmdb.ready() && !String(id).startsWith("sample")) {
    movie = await MI_API.tmdb.movieDetails(id);
  }
  if (!movie) {
    // graceful fallback using curated data when TMDB isn't configured
    const fallback = window.MI_ROADMAP.find(r => "sample-" + window.MI_ROADMAP.indexOf(r) === id) || window.MI_ROADMAP[0];
    movie = {
      id, title: fallback.title, overview: fallback.synopsisFallback || "Add a TMDB API key in js/config.js to load full synopses, cast and ratings live.",
      release_date: fallback.year + "-01-01", poster_path: null, backdrop_path: null,
      genres: [], runtime: null, credits: { cast: [] }, external_ids: {}, vote_average: null
    };
  }

  const imdbId = movie.external_ids && movie.external_ids.imdb_id;
  const [omdbData, watchSources] = await Promise.all([
    imdbId && MI_API.omdb.ready() ? MI_API.omdb.byImdbId(imdbId) : Promise.resolve(null),
    imdbId && MI_API.watchmode.ready() ? watchmodeSourcesForImdb(imdbId) : Promise.resolve(null)
  ]);

  const cast = (movie.credits && movie.credits.cast || []).slice(0, 12);
  const wishlisted = MI_AUTH.isWishlisted(currentUser(), movie.id, "movie");
  const commentKey = keyFor("movie", movie.id);
  const comments = MI_AUTH.getComments(commentKey);

  app.innerHTML = `
    <section class="detail" style="${movie.backdrop_path ? `--hero-bg:url('${MI_API.tmdb.backdropUrl(movie.backdrop_path)}')` : ""}">
      <div class="detail-inner comic-panel">
        <img class="detail-poster" src="${movie.poster_path ? MI_API.tmdb.posterUrl(movie.poster_path) : "assets/placeholder-poster.svg"}" alt="${movie.title} poster">
        <div class="detail-copy">
          <h1>${movie.title}</h1>
          <p class="muted">${fmtDate(movie.release_date)} ${movie.runtime ? `· ${movie.runtime} min` : ""} ${movie.genres && movie.genres.length ? "· " + movie.genres.map(g => g.name).join(", ") : ""}</p>
          <div class="ratings">
            ${movie.vote_average ? `<span class="badge">TMDB ${movie.vote_average.toFixed(1)}/10</span>` : ""}
            ${omdbData && omdbData.imdbRating && omdbData.imdbRating !== "N/A" ? `<span class="badge">IMDb ${omdbData.imdbRating}/10</span>` : ""}
            ${omdbData && omdbData.Ratings ? (omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes") ? `<span class="badge">RT ${omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes").Value}</span>` : "") : ""}
          </div>
          <p class="overview">${movie.overview || ""}</p>
          <div class="hero-cta">
            <button class="pill ${wishlisted ? "primary" : ""}" id="wishlist-btn">${wishlisted ? "★ In wishlist" : "☆ Add to wishlist"}</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Where to watch</h2>
      <div id="watch-providers">${renderWatchProviders(movie, watchSources)}</div>
    </section>

    ${cast.length ? `
    <section class="section">
      <h2>Cast &amp; characters</h2>
      <div class="cast-grid">
        ${cast.map(c => `
          <div class="cast-card comic-panel">
            <img src="${c.profile_path ? MI_API.tmdb.posterUrl(c.profile_path) : "assets/placeholder-avatar.svg"}" alt="${c.name}">
            <strong>${c.name}</strong>
            <span class="muted">as ${c.character}</span>
          </div>`).join("")}
      </div>
    </section>` : ""}

    <section class="section">
      <h2>Comments</h2>
      <div id="comments-list">${renderComments(comments)}</div>
      <form id="comment-form" class="comment-form">
        <textarea name="text" placeholder="${currentUser() ? "Share your take…" : "Sign up or log in to comment"}" ${currentUser() ? "" : "disabled"}></textarea>
        <button class="pill primary" type="submit" ${currentUser() ? "" : "disabled"}>Post</button>
      </form>
      <p class="form-error" id="comment-error"></p>
    </section>
  `;

  document.getElementById("wishlist-btn").onclick = () => {
    const user = currentUser();
    if (!user) { openAuthModal(); return; }
    const result = MI_AUTH.toggleWishlist(user, { id: movie.id, type: "movie", title: movie.title, poster: movie.poster_path ? MI_API.tmdb.posterUrl(movie.poster_path) : null });
    renderMovie(id);
  };

  document.getElementById("comment-form").onsubmit = (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("text");
    const result = MI_AUTH.addComment(currentUser(), commentKey, text);
    if (!result.ok) { document.getElementById("comment-error").textContent = result.error; return; }
    renderMovie(id);
  };
}

async function watchmodeSourcesForImdb(imdbId) {
  const search = await MI_API.watchmode.searchByImdb(imdbId);
  const titleId = search && search.title_results && search.title_results[0] && search.title_results[0].id;
  if (!titleId) return null;
  return MI_API.watchmode.sources(titleId);
}

function renderWatchProviders(movie, watchSources) {
  const tmdbProviders = movie["watch/providers"] && movie["watch/providers"].results && movie["watch/providers"].results.IN;
  const flat = [];
  if (tmdbProviders) {
    ["flatrate", "rent", "buy"].forEach(kind => (tmdbProviders[kind] || []).forEach(p => flat.push({ name: p.provider_name, logo: MI_API.tmdb.posterUrl(p.logo_path), kind })));
  }
  if (watchSources && watchSources.length) {
    watchSources.forEach(s => flat.push({ name: s.name, logo: s.web_url ? null : null, kind: s.type }));
  }
  if (!flat.length) return `<p class="muted">No streaming data yet — add a TMDB and/or Watchmode key in js/config.js to populate this from live availability.</p>`;
  const seen = new Set();
  const unique = flat.filter(p => { const k = p.name + p.kind; if (seen.has(k)) return false; seen.add(k); return true; });
  return `<div class="providers">${unique.map(p => `<span class="provider-pill">${p.logo ? `<img src="${p.logo}" alt="">` : ""}${p.name} <em>${p.kind}</em></span>`).join("")}</div>`;
}

function renderComments(comments) {
  if (!comments.length) return `<p class="muted">No comments yet — be the first.</p>`;
  return comments.slice().reverse().map(c => `
    <div class="comment">
      <strong>${c.user}</strong> <span class="muted">${new Date(c.at).toLocaleString("en-IN")}</span>
      <p>${c.text.replace(/</g, "&lt;")}</p>
    </div>`).join("");
}

// ---------------------------------------------------------------- TIMELINE
function renderTimeline() {
  const items = window.MI_TIMELINE;
  app.innerHTML = `
    <section class="section">
      <h1>MCU Timeline</h1>
      <p class="muted">In-universe chronological order — not release order — so you can follow the story the way it actually happens.</p>
      <div class="timeline">
        ${items.map(i => `
          <div class="timeline-item ${i.spotlight ? "spotlight" : ""}">
            <div class="timeline-year">${i.year}</div>
            <div class="timeline-card comic-panel">
              <h3>${i.title}</h3>
              <p>${i.blurb}</p>
            </div>
          </div>`).join("")}
      </div>
    </section>`;
}

// ---------------------------------------------------------------- ROADMAP
function renderRoadmap() {
  const user = currentUser();
  const watched = MI_AUTH.getWatched(user);
  const byPhase = {};
  window.MI_ROADMAP.forEach(m => { (byPhase[m.phase] = byPhase[m.phase] || []).push(m); });

  app.innerHTML = `
    <section class="section">
      <h1>Movie Roadmap</h1>
      <p class="muted">Every MCU film, release order, phase by phase. Check off what you've watched — ${user ? `saved for ${user}` : "log in to save your progress across visits"}.</p>
      ${window.MI_PHASES.map(phase => {
        const movies = byPhase[phase.id] || [];
        if (!movies.length) return "";
        return `
        <div class="phase-block">
          <h2>${phase.label} <span class="muted">· ${phase.saga} · ${phase.years}</span></h2>
          <ul class="roadmap-list">
            ${movies.map(m => `
              <li class="${watched.includes(m.title) ? "done" : ""} ${m.status === "upcoming" ? "upcoming" : ""}">
                <label>
                  <input type="checkbox" data-title="${m.title.replace(/"/g, "&quot;")}" ${watched.includes(m.title) ? "checked" : ""}>
                  <span>${m.title} <em class="muted">(${m.year})</em></span>
                </label>
                ${m.status === "upcoming" ? `<span class="tag">Upcoming</span>` : ""}
              </li>`).join("")}
          </ul>
        </div>`;
      }).join("")}
    </section>`;

  app.querySelectorAll('input[type=checkbox][data-title]').forEach(cb => {
    cb.onchange = () => { MI_AUTH.toggleWatched(user, cb.dataset.title); cb.closest("li").classList.toggle("done", cb.checked); };
  });
}

// ---------------------------------------------------------------- CHARACTERS
function renderCharacters() {
  const chars = window.MI_CHARACTERS;
  app.innerHTML = `
    <section class="section">
      <h1>Character Database</h1>
      <p class="muted">Actor, aliases, powers and first appearance for every major MCU hero and villain. Backed by curated data plus the free Marvel Comics API when a key is set.</p>
      <input id="char-filter" placeholder="Filter by name or actor…" class="filter-input">
      <div class="char-grid" id="char-grid">
        ${chars.map((c, i) => characterCard(c, i)).join("")}
      </div>
    </section>`;
  document.getElementById("char-filter").oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.getElementById("char-grid").innerHTML = chars
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.name.toLowerCase().includes(q) || c.actor.toLowerCase().includes(q))
      .map(({ c, i }) => characterCard(c, i)).join("") || `<p class="muted">No matches.</p>`;
  };
}
function characterCard(c, i) {
  return `
    <a class="char-card comic-panel" href="#/character/${i}">
      <h3>${c.name}</h3>
      <p class="muted">Played by ${c.actor}</p>
      <p class="tag">${c.affiliation}</p>
    </a>`;
}
async function renderCharacterDetail(idx) {
  const c = window.MI_CHARACTERS[idx];
  if (!c) { location.hash = "#/characters"; return; }
  app.innerHTML = `<div class="loading">Pulling comics data…</div>`;

  let comicHits = [];
  if (MI_API.marvel.ready()) {
    const first = c.name.split(" / ")[1] || c.name.split(" / ")[0];
    const search = await MI_API.marvel.searchCharacter(first.split(" ")[0]);
    const match = search && search.data && search.data.results && search.data.results[0];
    if (match) {
      const comics = await MI_API.marvel.characterComics(match.id);
      comicHits = (comics && comics.data && comics.data.results || []).slice(0, 8);
    }
  }

  app.innerHTML = `
    <section class="section">
      <a href="#/characters" class="link">← All characters</a>
      <h1>${c.name}</h1>
      <p class="muted">Played by <strong>${c.actor}</strong> · First appearance: ${c.firstAppearance}</p>
      <div class="char-detail-grid">
        <div class="comic-panel char-fact"><h4>Aliases</h4><p>${c.aliases.join(", ")}</p></div>
        <div class="comic-panel char-fact"><h4>Powers &amp; abilities</h4><p>${c.powers}</p></div>
        <div class="comic-panel char-fact"><h4>Affiliation</h4><p>${c.affiliation}</p></div>
      </div>
      ${comicHits.length ? `
        <h2>From the comics</h2>
        <div class="grid">
          ${comicHits.map(cm => `
            <div class="card comic-panel">
              <div class="card-poster" style="background-image:url('${cm.thumbnail.path}.${cm.thumbnail.extension}')"></div>
              <div class="card-body"><h3>${cm.title}</h3></div>
            </div>`).join("")}
        </div>` : `<p class="notice">Add a free Marvel Comics API key pair in js/config.js to pull real comic appearances here.</p>`}
    </section>`;
}

// ---------------------------------------------------------------- WISHLIST
function renderWishlist() {
  const user = currentUser();
  if (!user) { openAuthModal(); location.hash = "#/home"; return; }
  const list = MI_AUTH.getWishlist(user);
  app.innerHTML = `
    <section class="section">
      <h1>${user}'s wishlist</h1>
      ${list.length ? `<div class="grid">${list.map(i => posterCard({ id: i.id, title: i.title, year: "", poster: i.poster })).join("")}</div>`
        : `<p class="muted">Nothing saved yet — open any title and tap “Add to wishlist”.</p>`}
    </section>`;
}

// ---------------------------------------------------------------- ROUTER
function parseHash() {
  const raw = location.hash.slice(1) || "/home";
  const [path, qs] = raw.split("?");
  const params = new URLSearchParams(qs || "");
  return { path, params };
}
function route() {
  const { path, params } = parseHash();
  document.querySelectorAll(".navlink").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + path.split("/").slice(0, 2).join("/")));
  if (path === "/home" || path === "/") return renderHome();
  if (path === "/search") return renderSearch(params.get("q"));
  if (path.startsWith("/movie/")) return renderMovie(path.split("/")[2]);
  if (path === "/timeline") return renderTimeline();
  if (path === "/roadmap") return renderRoadmap();
  if (path === "/characters") return renderCharacters();
  if (path.startsWith("/character/")) return renderCharacterDetail(Number(path.split("/")[2]));
  if (path === "/wishlist") return renderWishlist();
  app.innerHTML = `<section class="section"><h1>Page not found</h1><a href="#/home" class="link">← Home</a></section>`;
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => { updateAuthHeader(); route(); });
