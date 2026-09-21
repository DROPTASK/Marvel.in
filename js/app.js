/**
 * Marvel India — app shell.
 * Hash-router SPA. Every screen reads from Supabase (js/db.js) — nothing is
 * loaded from a bundled static array anymore. TMDB/OMDb/TVmaze/Watchmode
 * (js/api.js) are used only to *enrich* DB rows with live posters/ratings/
 * streaming availability.
 */
const app = document.getElementById("app");
const tmdbCache = new Map(); // tmdb_query -> tmdb result, avoids refetching per view

// ---------------------------------------------------------------- helpers
function fmtDate(d) { if (!d) return "TBA"; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }); }
function fmtMinutes(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${m}m` : `${m}m`; }
function esc(str) { return (str || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function currentUserId() { return MI_AUTH.currentUserId(); }
function currentUsername() { return MI_AUTH.currentUsername(); }

async function enrichWithTmdb(query) {
  if (!query || !MI_API.tmdb.ready()) return null;
  if (tmdbCache.has(query)) return tmdbCache.get(query);
  const result = await MI_API.tmdb.findByTitle(query);
  tmdbCache.set(query, result);
  return result;
}

// ---------------------------------------------------------------- header / nav
function updateAuthHeader() {
  const slot = document.getElementById("auth-slot");
  const userId = currentUserId();
  const uname = currentUsername();
  slot.innerHTML = userId
    ? `<button class="icon-btn" id="notif-btn" title="Notifications">🔔</button>
       <span class="hello">${esc(uname)}</span>
       <a href="#/wishlist" class="pill">Wishlist</a>
       <button class="pill ghost" id="logout-btn">Log out</button>`
    : `<button class="pill" id="open-auth">Sign up / Log in</button>`;
  if (userId) {
    document.getElementById("logout-btn").onclick = async () => { await MI_AUTH.logout(); updateAuthHeader(); route(); };
    document.getElementById("notif-btn").onclick = openNotificationsModal;
  } else {
    document.getElementById("open-auth").onclick = openAuthModal;
  }
}

async function openNotificationsModal() {
  const userId = currentUserId();
  const profile = await MI_DB.getProfile(userId);
  const enabled = profile && profile.notifications_enabled;
  document.getElementById("modal-root").innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal comic-panel">
        <button class="modal-close" id="modal-close">&times;</button>
        <h2>Notifications</h2>
        <p class="muted">Get a browser notification the moment a new blog post goes live, while this tab is open.</p>
        <button class="pill primary full" id="notif-toggle">${enabled ? "Turn off notifications" : "Turn on notifications"}</button>
        <p class="form-error" id="notif-error"></p>
        <p class="fine-print">This uses your browser's native Notification permission and only fires while Marvel India is open in a tab — it isn't push-to-your-phone notifications yet. See the README for how to add real push.</p>
      </div>
    </div>`;
  document.getElementById("modal-close").onclick = closeModal;
  document.getElementById("modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };
  document.getElementById("notif-toggle").onclick = async () => {
    const result = enabled ? await MI_NOTIFY.disable(userId) : await MI_NOTIFY.enable(userId);
    if (!result.ok) { document.getElementById("notif-error").textContent = result.error; return; }
    closeModal();
  };
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
          <label id="username-field" style="display:none">Username <input name="username" autocomplete="username"></label>
          <label>Email <input name="email" type="email" required autocomplete="email"></label>
          <label>Password <input name="password" type="password" required autocomplete="current-password" minlength="6"></label>
          <p class="form-error" id="auth-error"></p>
          <button type="submit" class="pill primary full">Log in</button>
        </form>
        <p class="fine-print">Accounts are real Supabase accounts — your data is stored server-side, not just in this browser.</p>
      </div>
    </div>`;
  let mode = "login";
  const form = document.getElementById("auth-form");
  const submitBtn = form.querySelector("button[type=submit]");
  document.querySelectorAll(".tab").forEach(tabBtn => tabBtn.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    tabBtn.classList.add("active");
    mode = tabBtn.dataset.tab;
    document.getElementById("username-field").style.display = mode === "signup" ? "flex" : "none";
    document.querySelector('[name=username]').required = mode === "signup";
    submitBtn.textContent = mode === "login" ? "Log in" : "Create account";
  });
  document.getElementById("modal-close").onclick = closeModal;
  document.getElementById("modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    submitBtn.disabled = true;
    const result = mode === "login"
      ? await MI_AUTH.login(fd.get("email"), fd.get("password"))
      : await MI_AUTH.signup(fd.get("username"), fd.get("email"), fd.get("password"));
    submitBtn.disabled = false;
    if (!result.ok) { document.getElementById("auth-error").textContent = result.error; return; }
    if (result.needsEmailConfirm) { document.getElementById("auth-error").style.color = "var(--gold)"; document.getElementById("auth-error").textContent = "Check your email to confirm your account, then log in."; return; }
    closeModal(); updateAuthHeader(); route();
  };
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

function posterCard(item) {
  const poster = item.poster || "assets/placeholder-poster.svg";
  const title = item.title || item.name || "";
  const year = item.year || (item.release_date ? String(item.release_date).slice(0, 4) : "");
  const id = item.id != null ? item.id : (item.tmdb_id || "");
  const safePoster = poster && String(poster).startsWith("http")
    ? poster.replace("http://", "https://")
    : (poster || "assets/placeholder-poster.svg");
  return `
    <a class="card comic-panel" href="#/movie/${id}">
      <div class="card-poster">
        <img src="${safePoster}" alt="${esc(title)}" loading="lazy"
          onerror="this.onerror=null;this.src='assets/placeholder-poster.svg'">
      </div>
      <div class="card-body">
        <h3>${esc(title)}</h3>
        <span class="muted">${year}</span>
      </div>
    </a>`;
}

// ---------------------------------------------------------------- HOME
async function renderHome() {
  app.innerHTML = `<div class="loading">Assembling the roster…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }

  const [spotlight, roadmap] = await Promise.all([MI_DB.getSpotlightMovie(), MI_DB.getRoadmap()]);
  const doom = spotlight || (roadmap && roadmap.find(m => m.status === "upcoming")) || (roadmap && roadmap[roadmap.length - 1]) || { title: "Avengers: Doomsday", release_date: "2026-12-18", tmdb_query: "Avengers Doomsday" };
  const doomTmdb = await enrichWithTmdb(doom.tmdb_query);

  const doomPoster = (() => {
    const p = doomTmdb ? MI_API.tmdb.posterUrl(doomTmdb.poster_path) : null;
    return p ? String(p).replace("http://", "https://") : "assets/placeholder-poster.svg";
  })();
  const doomBackdrop = doomTmdb ? MI_API.tmdb.backdropUrl(doomTmdb.backdrop_path) : null;
  const doomOverview = (doomTmdb && doomTmdb.overview) || doom.synopsis || "";
  const doomRelease = doom.release_date;

  const recent = (roadmap || []).slice(-12).reverse();
  const enriched = await Promise.all(recent.map(async m => {
    const t = await enrichWithTmdb(m.tmdb_query);
    const pp = t ? MI_API.tmdb.posterUrl(t.poster_path) : null;
    return { id: m.id, title: m.title, year: m.year, poster: pp ? String(pp).replace("http://", "https://") : null };
  }));

  app.innerHTML = `
    <section class="hero" style="${doomBackdrop ? `--hero-bg:url('${doomBackdrop}')` : ""}">
      <div class="hero-inner comic-panel">
        <div class="hero-copy">
          <p class="kicker">The Doomsday Clock is ticking</p>
          <h1>${esc(doom.title)}</h1>
          <div class="doom-date-row">
            <p class="hero-date release-date">In cinemas ${fmtDate(doomRelease)}</p>
            <div id="doom-countdown" class="countdown-inline"></div>
          </div>
          <p class="hero-overview">${esc(doomOverview)}</p>
          <div class="hero-cta">
            <a href="#/movie/${doom.id}" class="pill primary">Full details</a>
            <a href="#/roadmap" class="pill ghost">Build your watch plan</a>
          </div>
        </div>
        <div class="hero-poster"><img src="${doomPoster ? String(doomPoster).replace('http://','https://') : 'assets/placeholder-poster.svg'}" alt="${esc(doom.title)} poster" onerror="this.onerror=null;this.src='assets/placeholder-poster.svg'"></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Marvel, freshly reeled in</h2>
        <a href="#/search" class="link">Search everything →</a>
      </div>
      <div class="grid">${enriched.map(posterCard).join("")}</div>
    </section>

    <section class="section quicklinks">
      <a class="quick comic-panel" href="#/timeline"><h3>MCU Timeline</h3><p>The story in chronological order, movie by movie.</p></a>
      <a class="quick comic-panel" href="#/roadmap"><h3>Watch Plan</h3><p>A daily plan to finish everything before Doomsday.</p></a>
      <a class="quick comic-panel" href="#/characters"><h3>Character Database</h3><p>Every hero, actor, and power set.</p></a>
      <a class="quick comic-panel" href="#/blog"><h3>Blog</h3><p>Fan theories, reviews and news from the community.</p></a>
      <a class="quick comic-panel" href="#/shop"><h3>Shop</h3><p>Merch we love, via Amazon.</p></a>
    </section>
  `;
  startCountdown(doomRelease);
}

function supabaseNotConfiguredNotice() {
  return `<section class="section"><div class="notice comic-panel" style="padding:20px">
    <h2>Supabase isn't connected yet</h2>
    <p>Fill in <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in <code>js/config.js</code>, then run the three SQL files in <code>supabase/</code> against your project. See the README for the full walkthrough.</p>
  </div></section>`;
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
  const SUGGESTIONS = [
    "Spider-Man", "Iron Man", "Avengers", "Thor", "Black Panther", "Doctor Strange",
    "Guardians of the Galaxy", "Captain America", "Loki", "WandaVision", "Deadpool",
    "X-Men", "Fantastic Four", "Ant-Man", "Shang-Chi", "Eternals", "Hawkeye"
  ];
  app.innerHTML = `
    <section class="section">
      <h1>Search Marvel &amp; beyond</h1>
      <form id="search-form" class="search-form">
        <div class="search-wrap">
          <input name="q" id="search-input" placeholder="Search movies, shows, actors…" value="${esc(query || "")}" autocomplete="off" autofocus>
          <div class="search-suggestions" id="search-suggestions" hidden></div>
        </div>
        <button class="pill primary" type="submit">Search</button>
      </form>
      <div id="search-results">${query ? `<div class="loading">Searching…</div>` : `<p class="muted">Try "Spider-Man", "Loki", or "Doctor Strange". Type to see suggestions.</p>`}</div>
      ${!MI_API.tmdb.ready() ? `<p class="notice comic-panel" style="padding:12px">Live search needs a free TMDB key in js/config.js (or Vercel env via /api proxy).</p>` : ""}
    </section>`;

  const input = document.getElementById("search-input");
  const sugBox = document.getElementById("search-suggestions");
  let sugTimer = null;

  function showLocalSuggestions(val) {
    const v = (val || "").trim().toLowerCase();
    const list = !v
      ? SUGGESTIONS.slice(0, 8)
      : SUGGESTIONS.filter(s => s.toLowerCase().includes(v)).slice(0, 8);
    if (!list.length) { sugBox.hidden = true; sugBox.innerHTML = ""; return; }
    sugBox.innerHTML = list.map(s =>
      `<button type="button" data-q="${esc(s)}">${esc(s)}</button>`
    ).join("");
    sugBox.hidden = false;
    sugBox.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        input.value = btn.dataset.q;
        sugBox.hidden = true;
        location.hash = `#/search?q=${encodeURIComponent(btn.dataset.q)}`;
      };
    });
  }

  input.addEventListener("focus", () => showLocalSuggestions(input.value));
  input.addEventListener("input", () => {
    clearTimeout(sugTimer);
    const val = input.value;
    showLocalSuggestions(val);
    // Live TMDB suggestions after short debounce
    if (val.trim().length >= 2 && MI_API.tmdb.ready()) {
      sugTimer = setTimeout(async () => {
        const data = await MI_API.tmdb.search(val.trim());
        const results = (data && data.results || [])
          .filter(r => r.media_type !== "person")
          .slice(0, 6);
        if (!results.length) return;
        sugBox.innerHTML = results.map(r => {
          const title = r.title || r.name || "";
          const year = (r.release_date || r.first_air_date || "").slice(0, 4);
          return `<button type="button" data-q="${esc(title)}">${esc(title)}<span class="sug-meta">${year}</span></button>`;
        }).join("");
        sugBox.hidden = false;
        sugBox.querySelectorAll("button").forEach(btn => {
          btn.onclick = () => {
            input.value = btn.dataset.q;
            sugBox.hidden = true;
            location.hash = `#/search?q=${encodeURIComponent(btn.dataset.q)}`;
          };
        });
      }, 280);
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) sugBox.hidden = true;
  }, { once: false });

  document.getElementById("search-form").onsubmit = (e) => {
    e.preventDefault();
    sugBox.hidden = true;
    const q = new FormData(e.target).get("q").trim();
    location.hash = `#/search?q=${encodeURIComponent(q)}`;
  };

  if (!query) return;
  if (!MI_API.tmdb.ready()) {
    document.getElementById("search-results").innerHTML = `<p class="muted">Add a TMDB key to enable live search.</p>`;
    return;
  }
  const data = await MI_API.tmdb.search(query);

  const results = (data && data.results || []).filter(r => r.media_type === "movie" || r.media_type === "tv");
  const box = document.getElementById("search-results");
  if (!results.length) { box.innerHTML = `<p class="muted">No results for "${esc(query)}".</p>`; return; }
  box.innerHTML = `<div class="grid">${results.map(r => posterCard({
    id: "tmdb-" + r.id, title: r.title || r.name, year: (r.release_date || r.first_air_date || "").slice(0, 4),
    poster: MI_API.tmdb.posterUrl(r.poster_path)
  })).join("")}</div>`;
}

// ---------------------------------------------------------------- MOVIE DETAIL
async function renderMovie(id) {
  app.innerHTML = `<div class="loading">Pulling up the file…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }

  let dbMovie = String(id).startsWith("tmdb-") ? null : await MI_DB.getMovie(id);
  let tmdbId = String(id).startsWith("tmdb-") ? id.replace("tmdb-", "") : null;
  let tmdbFull = null;

  if (dbMovie) {
    const found = await enrichWithTmdb(dbMovie.tmdb_query);
    if (found) tmdbId = found.id;
  }
  if (tmdbId && MI_API.tmdb.ready()) tmdbFull = await MI_API.tmdb.movieDetails(tmdbId);

  const title = dbMovie ? dbMovie.title : (tmdbFull ? tmdbFull.title : "Untitled");
  const overview = (tmdbFull && tmdbFull.overview) || (dbMovie && dbMovie.synopsis) || "";
  const releaseDate = (tmdbFull && tmdbFull.release_date) || (dbMovie && dbMovie.release_date);
  const runtime = (tmdbFull && tmdbFull.runtime) || (dbMovie && dbMovie.runtime_minutes);
  const posterRaw = tmdbFull && tmdbFull.poster_path ? MI_API.tmdb.posterUrl(tmdbFull.poster_path) : "assets/placeholder-poster.svg";
  const poster = posterRaw ? String(posterRaw).replace("http://", "https://") : "assets/placeholder-poster.svg";
  const backdrop = tmdbFull && tmdbFull.backdrop_path ? MI_API.tmdb.backdropUrl(tmdbFull.backdrop_path) : null;
  const genres = tmdbFull && tmdbFull.genres || [];
  const cast = (tmdbFull && tmdbFull.credits && tmdbFull.credits.cast || []).slice(0, 12);
  const imdbId = tmdbFull && tmdbFull.external_ids && tmdbFull.external_ids.imdb_id;

  const [omdbData, watchSources] = await Promise.all([
    imdbId && MI_API.omdb.ready() ? MI_API.omdb.byImdbId(imdbId) : Promise.resolve(null),
    imdbId && MI_API.watchmode.ready() ? watchmodeSourcesForImdb(imdbId) : Promise.resolve(null)
  ]);

  const userId = currentUserId();
  const wishlisted = userId ? await MI_DB.isWishlisted(userId, id, "movie") : false;
  const comments = await MI_DB.getComments("movie", id);

  app.innerHTML = `
    <section class="detail" style="${backdrop ? `--hero-bg:url('${backdrop}')` : ""}">
      <div class="detail-inner comic-panel">
        <div class="detail-copy">
          <h1>${esc(title)}</h1>
          <p class="muted">${fmtDate(releaseDate)} ${runtime ? `· ${fmtMinutes(runtime)}` : ""} ${genres.length ? "· " + genres.map(g => g.name).join(", ") : ""}</p>
          ${dbMovie ? `<p class="tag">${dbMovie.priority.replace("-", " ")}</p>` : ""}
          <div class="ratings">
            ${tmdbFull && tmdbFull.vote_average ? `<span class="badge">TMDB ${tmdbFull.vote_average.toFixed(1)}/10</span>` : ""}
            ${omdbData && omdbData.imdbRating && omdbData.imdbRating !== "N/A" ? `<span class="badge">IMDb ${omdbData.imdbRating}/10</span>` : ""}
            ${omdbData && omdbData.Ratings && omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes") ? `<span class="badge">RT ${omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes").Value}</span>` : ""}
          </div>
          <p class="overview">${esc(overview)}</p>
          <div class="hero-cta">
            <button class="pill ${wishlisted ? "primary" : ""}" id="wishlist-btn">${wishlisted ? "★ In wishlist" : "☆ Add to wishlist"}</button>
          </div>
        </div>
        <div class="detail-poster-wrap">
          <img class="detail-poster" src="${poster}" alt="${esc(title)} poster"
            onerror="this.onerror=null;this.src='assets/placeholder-poster.svg'">
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Where to watch</h2>
      <div id="watch-providers">${renderWatchProviders(tmdbFull, watchSources)}</div>
    </section>

    ${cast.length ? `
    <section class="section">
      <h2>Cast &amp; characters</h2>
      <div class="cast-grid">
        ${cast.map(c => `
          <div class="cast-card comic-panel">
            <img src="${c.profile_path ? MI_API.tmdb.posterUrl(c.profile_path) : "assets/placeholder-avatar.svg"}" alt="${esc(c.name)}">
            <strong>${esc(c.name)}</strong>
            <span class="muted">as ${esc(c.character)}</span>
          </div>`).join("")}
      </div>
    </section>` : ""}

    <section class="section">
      <h2>Comments</h2>
      <div id="comments-list">${renderComments(comments)}</div>
      <form id="comment-form" class="comment-form">
        <textarea name="text" placeholder="${userId ? "Share your take…" : "Sign up or log in to comment"}" ${userId ? "" : "disabled"}></textarea>
        <button class="pill primary" type="submit" ${userId ? "" : "disabled"}>Post</button>
      </form>
      <p class="form-error" id="comment-error"></p>
    </section>
  `;

  document.getElementById("wishlist-btn").onclick = async () => {
    if (!userId) { openAuthModal(); return; }
    await MI_DB.toggleWishlist(userId, { id, type: "movie", title, poster: poster !== "assets/placeholder-poster.svg" ? poster : null });
    renderMovie(id);
  };

  document.getElementById("comment-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("text");
    const result = await MI_DB.addComment(userId, "movie", id, text);
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

function renderWatchProviders(tmdbFull, watchSources) {
  const tmdbProviders = tmdbFull && tmdbFull["watch/providers"] && tmdbFull["watch/providers"].results && tmdbFull["watch/providers"].results.IN;
  const flat = [];
  if (tmdbProviders) {
    ["flatrate", "rent", "buy"].forEach(kind => (tmdbProviders[kind] || []).forEach(p => flat.push({ name: p.provider_name, logo: MI_API.tmdb.posterUrl(p.logo_path), kind })));
  }
  if (watchSources && watchSources.length) watchSources.forEach(s => flat.push({ name: s.name, logo: null, kind: s.type }));
  if (!flat.length) return `<p class="muted">No streaming data yet — add a TMDB and/or Watchmode key in js/config.js to populate this from live availability.</p>`;
  const seen = new Set();
  const unique = flat.filter(p => { const k = p.name + p.kind; if (seen.has(k)) return false; seen.add(k); return true; });
  return `<div class="providers">${unique.map(p => `<span class="provider-pill">${p.logo ? `<img src="${p.logo}" alt="">` : ""}${esc(p.name)} <em>${esc(p.kind)}</em></span>`).join("")}</div>`;
}

function renderComments(comments) {
  if (!comments.length) return `<p class="muted">No comments yet — be the first.</p>`;
  return comments.map(c => `
    <div class="comment">
      <strong>${esc(c.profiles ? c.profiles.username : "someone")}</strong> <span class="muted">${new Date(c.created_at).toLocaleString("en-IN")}</span>
      <p>${esc(c.body)}</p>
    </div>`).join("");
}

// ---------------------------------------------------------------- TIMELINE
async function renderTimeline() {
  app.innerHTML = `<div class="loading">Loading the timeline…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const items = await MI_DB.getTimeline();
  app.innerHTML = `
    <section class="section">
      <h1>MCU Timeline</h1>
      <p class="muted">In-universe chronological order — not release order — so you can follow the story the way it actually happens.</p>
      <div class="timeline">
        ${items.map(i => `
          <div class="timeline-item ${i.spotlight ? "spotlight" : ""}">
            <div class="timeline-year">${esc(i.year_label)}</div>
            <div class="timeline-card comic-panel">
              <h3>${esc(i.movie_title)}</h3>
              <p>${esc(i.blurb)}</p>
            </div>
          </div>`).join("")}
      </div>
    </section>`;
}

// ---------------------------------------------------------------- ROADMAP (+ Doomsday watch plan)
async function renderRoadmap() {
  app.innerHTML = `<div class="loading">Building your roadmap…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const userId = currentUserId();
  const [roadmap, watchedIds, doom] = await Promise.all([MI_DB.getRoadmap(), MI_DB.getWatchedIds(userId), MI_DB.getSpotlightMovie()]);
  const watchedSet = new Set(watchedIds);

  const byPhase = {};
  const phaseMeta = {
    phase1: { label: "Phase One", saga: "Infinity Saga", years: "2008–2012" },
    phase2: { label: "Phase Two", saga: "Infinity Saga", years: "2013–2015" },
    phase3: { label: "Phase Three", saga: "Infinity Saga", years: "2016–2019" },
    phase4: { label: "Phase Four", saga: "Multiverse Saga", years: "2021–2022" },
    phase5: { label: "Phase Five", saga: "Multiverse Saga", years: "2023–2025" },
    phase6: { label: "Phase Six", saga: "Multiverse Saga", years: "2026–2027" }
  };
  roadmap.forEach(m => (byPhase[m.phase] = byPhase[m.phase] || []).push(m));

  // ---- Doomsday watch-plan calculator ----
  const doomsdayDate = doom ? new Date(doom.release_date) : null;
  const now = new Date();
  const daysLeft = doomsdayDate ? Math.max(1, Math.ceil((doomsdayDate - now) / 86400000)) : null;
  const unwatched = roadmap.filter(m => m.status === "released" && !watchedSet.has(m.id));
  const mustWatchUnwatched = unwatched.filter(m => m.priority === "must-watch");
  const remainingMinutesAll = unwatched.reduce((s, m) => s + m.runtime_minutes, 0);
  const remainingMinutesMustWatch = mustWatchUnwatched.reduce((s, m) => s + m.runtime_minutes, 0);
  const minutesPerDayAll = daysLeft ? Math.ceil(remainingMinutesAll / daysLeft) : 0;
  const minutesPerDayMust = daysLeft ? Math.ceil(remainingMinutesMustWatch / daysLeft) : 0;

  // Build a simple day-by-day plan (must-watch titles only, in story/release order)
  const plan = [];
  if (daysLeft) {
    let dayCursor = new Date(now);
    let bucket = [];
    let bucketMinutes = 0;
    const targetPerDay = Math.max(minutesPerDayMust, 90); // don't suggest absurdly small daily chunks
    mustWatchUnwatched.forEach(m => {
      bucket.push(m);
      bucketMinutes += m.runtime_minutes;
      if (bucketMinutes >= targetPerDay) {
        plan.push({ date: new Date(dayCursor), movies: bucket, minutes: bucketMinutes });
        dayCursor = new Date(dayCursor.getTime() + 86400000);
        bucket = []; bucketMinutes = 0;
      }
    });
    if (bucket.length) plan.push({ date: new Date(dayCursor), movies: bucket, minutes: bucketMinutes });
  }

  app.innerHTML = `
    <section class="section">
      <h1>Movie Roadmap</h1>
      <p class="muted">Every MCU film, release order, phase by phase. Check off what you've watched — ${userId ? "saved to your account" : "log in to save your progress"}.</p>

      <div class="watch-plan comic-panel">
        <h2>Doomsday Watch Plan</h2>
        ${doom ? `
        <div class="watch-plan-stats">
          <div><strong>${daysLeft}</strong><span>days until ${esc(doom.title)}</span></div>
          <div><strong>${unwatched.length}</strong><span>unwatched films</span></div>
          <div><strong>${fmtMinutes(remainingMinutesAll)}</strong><span>total remaining runtime</span></div>
          <div><strong>${fmtMinutes(remainingMinutesMustWatch)}</strong><span>must-watch remaining</span></div>
          <div><strong>~${fmtMinutes(minutesPerDayMust)}</strong><span>per day to finish must-watch in time</span></div>
        </div>
        ${!userId ? `<p class="notice">Log in so your watched list (and this plan) is personal to you.</p>` : ""}
        ${plan.length ? `
          <h3>Suggested daily schedule (must-watch titles)</h3>
          <ol class="plan-list">
            ${plan.map(day => `
              <li>
                <span class="plan-date">${day.date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                <span class="plan-movies">${day.movies.map(m => m.title).join(" + ")}</span>
                <span class="plan-minutes">${fmtMinutes(day.minutes)}</span>
              </li>`).join("")}
          </ol>` : `<p class="muted">You're all caught up on must-watch titles. 🎉</p>`}
        ` : `<p class="muted">Mark a movie as the "spotlight" title in Supabase to power this calculator — Avengers: Doomsday is seeded that way already.</p>`}
      </div>

      ${Object.keys(phaseMeta).map(phaseId => {
        const movies = byPhase[phaseId] || [];
        if (!movies.length) return "";
        const meta = phaseMeta[phaseId];
        return `
        <div class="phase-block">
          <h2>${meta.label} <span class="muted">· ${meta.saga} · ${meta.years}</span></h2>
          <ul class="roadmap-list">
            ${movies.map(m => `
              <li class="${watchedSet.has(m.id) ? "done" : ""} ${m.status === "upcoming" ? "upcoming" : ""}" data-id="${m.id}">
                <label>
                  <input type="checkbox" data-id="${m.id}" ${watchedSet.has(m.id) ? "checked" : ""} ${m.status === "upcoming" ? "disabled" : ""}>
                  <span><a href="#/movie/${m.id}">${esc(m.title)}</a> <em class="muted">(${m.year})</em></span>
                </label>
                <span class="roadmap-meta">
                  <span class="tag priority-${m.priority}">${m.priority.replace("-", " ")}</span>
                  <span class="muted">${fmtMinutes(m.runtime_minutes)}</span>
                  ${m.status === "upcoming" ? `<span class="tag upcoming-tag">Upcoming</span>` : ""}
                </span>
              </li>`).join("")}
          </ul>
        </div>`;
      }).join("")}
    </section>`;

  app.querySelectorAll('input[type=checkbox][data-id]').forEach(cb => {
    cb.onchange = async () => {
      if (!userId) { cb.checked = !cb.checked; openAuthModal(); return; }
      await MI_DB.toggleWatched(userId, cb.dataset.id, cb.checked);
      renderRoadmap();
    };
  });
}

// ---------------------------------------------------------------- CHARACTERS
async function renderCharacters() {
  app.innerHTML = `<div class="loading">Loading the roster…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const chars = await MI_DB.getCharacters();
  app.innerHTML = `
    <section class="section">
      <h1>Character Database</h1>
      <p class="muted">Actor, aliases, powers and first appearance for every major MCU hero and villain, plus real comic appearances via the Marvel Comics API when configured.</p>
      <input id="char-filter" placeholder="Filter by name or actor…" class="filter-input">
      <div class="char-grid" id="char-grid">${chars.map(characterCard).join("")}</div>
    </section>`;
  document.getElementById("char-filter").oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.getElementById("char-grid").innerHTML = chars
      .filter(c => c.name.toLowerCase().includes(q) || c.actor.toLowerCase().includes(q))
      .map(characterCard).join("") || `<p class="muted">No matches.</p>`;
  };
}
function characterCard(c) {
  return `
    <a class="char-card comic-panel" href="#/character/${c.id}">
      <h3>${esc(c.name)}</h3>
      <p class="muted">Played by ${esc(c.actor)}</p>
      <p class="tag">${esc(c.affiliation || "")}</p>
    </a>`;
}
async function renderCharacterDetail(id) {
  app.innerHTML = `<div class="loading">Pulling comics data…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const c = await MI_DB.getCharacterById(id);
  if (!c) { location.hash = "#/characters"; return; }

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
      <h1>${esc(c.name)}</h1>
      <p class="muted">Played by <strong>${esc(c.actor)}</strong> · First appearance: ${esc(c.first_appearance || "")}</p>
      <div class="char-detail-grid">
        <div class="comic-panel char-fact"><h4>Aliases</h4><p>${(c.aliases || []).map(esc).join(", ")}</p></div>
        <div class="comic-panel char-fact"><h4>Powers &amp; abilities</h4><p>${esc(c.powers || "")}</p></div>
        <div class="comic-panel char-fact"><h4>Affiliation</h4><p>${esc(c.affiliation || "")}</p></div>
      </div>
      ${comicHits.length ? `
        <h2>From the comics</h2>
        <div class="grid">
          ${comicHits.map(cm => `
            <div class="card comic-panel">
              <div class="card-poster" style="background-image:url('${cm.thumbnail.path}.${cm.thumbnail.extension}')"></div>
              <div class="card-body"><h3>${esc(cm.title)}</h3></div>
            </div>`).join("")}
        </div>` : `<p class="notice">Add a free Marvel Comics API key pair in js/config.js to pull real comic appearances here.</p>`}
    </section>`;
}

// ---------------------------------------------------------------- WISHLIST
async function renderWishlist() {
  const userId = currentUserId();
  if (!userId) { openAuthModal(); location.hash = "#/home"; return; }
  app.innerHTML = `<div class="loading">Loading your wishlist…</div>`;
  const list = await MI_DB.getWishlist(userId);
  app.innerHTML = `
    <section class="section">
      <h1>${esc(currentUsername())}'s wishlist</h1>
      ${list.length ? `<div class="grid">${list.map(i => posterCard({ id: i.item_id, title: i.title, year: "", poster: i.poster_url })).join("")}</div>`
        : `<p class="muted">Nothing saved yet — open any title and tap "Add to wishlist".</p>`}
    </section>`;
}

// ---------------------------------------------------------------- BLOG
async function renderBlogList() {
  app.innerHTML = `<div class="loading">Loading posts…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const posts = await MI_DB.getBlogPosts();
  const userId = currentUserId();
  app.innerHTML = `
    <section class="section">
      <div class="section-head">
        <h1>Blog</h1>
        ${userId ? `<a href="#/blog/new" class="pill primary">Write a post</a>` : `<button class="pill" id="blog-login-btn">Log in to write</button>`}
      </div>
      ${posts.length ? `<div class="blog-grid">${posts.map(blogCard).join("")}</div>` : `<p class="muted">No posts yet — be the first to write one.</p>`}
    </section>`;
  if (!userId) document.getElementById("blog-login-btn").onclick = openAuthModal;
}
function blogCard(p) {
  return `
    <a class="blog-card comic-panel" href="#/blog/${p.slug}">
      ${p.cover_image_url ? `<div class="blog-cover" style="background-image:url('${p.cover_image_url}')"></div>` : ""}
      <div class="blog-card-body">
        <h3>${esc(p.title)}</h3>
        <p class="muted">by ${esc(p.profiles ? p.profiles.username : "someone")} · ${fmtDate(p.created_at)}</p>
        <p>${esc(p.body.slice(0, 140))}${p.body.length > 140 ? "…" : ""}</p>
        ${(p.tags || []).length ? `<div class="tag-row">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
      </div>
    </a>`;
}
async function renderBlogPost(slug) {
  app.innerHTML = `<div class="loading">Loading post…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const post = await MI_DB.getBlogPost(slug);
  if (!post) { app.innerHTML = `<section class="section"><h1>Post not found</h1><a href="#/blog" class="link">← All posts</a></section>`; return; }
  const userId = currentUserId();
  const comments = await MI_DB.getBlogComments(post.id);
  app.innerHTML = `
    <section class="section">
      <a href="#/blog" class="link">← All posts</a>
      ${post.cover_image_url ? `<div class="blog-detail-cover" style="background-image:url('${post.cover_image_url}')"></div>` : ""}
      <h1>${esc(post.title)}</h1>
      <p class="muted">by ${esc(post.profiles ? post.profiles.username : "someone")} · ${fmtDate(post.created_at)}</p>
      ${(post.tags || []).length ? `<div class="tag-row">${post.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="blog-body">${esc(post.body).split("\n\n").map(p => `<p>${p}</p>`).join("")}</div>

      <h2>Comments</h2>
      <div id="comments-list">${renderComments(comments.map(c => ({ ...c, body: c.body })))}</div>
      <form id="comment-form" class="comment-form">
        <textarea name="text" placeholder="${userId ? "Add a comment…" : "Sign up or log in to comment"}" ${userId ? "" : "disabled"}></textarea>
        <button class="pill primary" type="submit" ${userId ? "" : "disabled"}>Post</button>
      </form>
      <p class="form-error" id="comment-error"></p>
    </section>`;
  document.getElementById("comment-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("text");
    const result = await MI_DB.addBlogComment(userId, post.id, text);
    if (!result.ok) { document.getElementById("comment-error").textContent = result.error; return; }
    renderBlogPost(slug);
  };
}
function renderNewBlogForm() {
  const userId = currentUserId();
  if (!userId) { openAuthModal(); location.hash = "#/blog"; return; }
  app.innerHTML = `
    <section class="section">
      <h1>Write a post</h1>
      <form id="new-post-form" class="stacked-form comic-panel">
        <label>Title <input name="title" required></label>
        <label>Tags <input name="tags" placeholder="theory, review, phase-6"></label>
        <label>Cover image <input name="cover" type="file" accept="image/*"></label>
        <label>Body <textarea name="body" rows="10" required placeholder="Separate paragraphs with a blank line."></textarea></label>
        <p class="form-error" id="post-error"></p>
        <button class="pill primary" type="submit">Publish</button>
      </form>
    </section>`;
  document.getElementById("new-post-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const coverFile = fd.get("cover") && fd.get("cover").size ? fd.get("cover") : null;
    const result = await MI_DB.createBlogPost(userId, { title: fd.get("title"), body: fd.get("body"), tags: fd.get("tags"), coverFile });
    if (!result.ok) { document.getElementById("post-error").textContent = result.error; return; }
    location.hash = `#/blog/${result.slug}`;
  };
}

// ---------------------------------------------------------------- SHOP (Amazon affiliate)
async function renderShop() {
  app.innerHTML = `<div class="loading">Loading the shop…</div>`;
  if (!MI_SUPABASE.ready) { app.innerHTML = supabaseNotConfiguredNotice(); return; }
  const products = await MI_DB.getAffiliateProducts();
  const tag = window.MARVEL_INDIA_CONFIG.AMAZON_AFFILIATE_TAG;
  app.innerHTML = `
    <section class="section">
      <h1>Shop</h1>
      <p class="muted">Curated Marvel merch. As an Amazon Associate, Marvel India earns from qualifying purchases made through these links, at no extra cost to you.</p>
      <div class="shop-grid">
        ${products.map(p => {
          const url = new URL(p.amazon_url);
          if (tag && tag !== "your-affiliate-tag-21") url.searchParams.set("tag", tag);
          return `
          <a class="shop-card comic-panel" href="${url.toString()}" target="_blank" rel="noopener sponsored">
            <div class="card-poster" style="background-image:url('${p.image_url || "assets/placeholder-poster.svg"}')"></div>
            <div class="card-body">
              <h3>${esc(p.title)}</h3>
              <p class="muted">${esc(p.category || "")} ${p.price_label ? "· " + esc(p.price_label) : ""}</p>
              <p>${esc(p.blurb || "")}</p>
              <span class="pill primary full">View on Amazon ↗</span>
            </div>
          </a>`;
        }).join("")}
      </div>
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
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  const { path, params } = parseHash();
  const parts = path.split("/").filter(Boolean);
  const top = parts[0] || "home";
  document.querySelectorAll(".navlink").forEach(a => {
    const href = a.getAttribute("href") || "";
    const routeName = (href.replace("#/", "").split("/")[0]) || "home";
    a.classList.toggle("active", routeName === top || (top === "movie" && routeName === "search"));
  });

  if (path === "/home" || path === "/") return renderHome();
  if (path === "/search") return renderSearch(params.get("q"));
  if (path.startsWith("/movie/")) return renderMovie(path.split("/")[2]);
  if (path === "/timeline") return renderTimeline();
  if (path === "/roadmap") return renderRoadmap();
  if (path === "/characters") return renderCharacters();
  if (path.startsWith("/character/")) return renderCharacterDetail(Number(path.split("/")[2]));
  if (path === "/wishlist") return renderWishlist();
  if (path === "/blog") return renderBlogList();
  if (path === "/blog/new") return renderNewBlogForm();
  if (path.startsWith("/blog/")) return renderBlogPost(path.split("/")[2]);
  if (path === "/shop") return renderShop();
  app.innerHTML = `<section class="section"><h1>Page not found</h1><a href="#/home" class="link">← Home</a></section>`;
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-backdrop")?.classList.remove("open");
}
function openSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebar-backdrop")?.classList.add("open");
}
function initSidebar() {
  document.getElementById("menu-toggle")?.addEventListener("click", openSidebar);
  document.getElementById("sidebar-close")?.addEventListener("click", closeSidebar);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebar);
  document.querySelectorAll(".sidebar-nav .navlink").forEach(a => {
    a.addEventListener("click", () => closeSidebar());
  });
}

window.addEventListener("hashchange", route);
window.addEventListener("mi-auth-changed", () => { updateAuthHeader(); });
window.addEventListener("DOMContentLoaded", async () => {
  initSidebar();
  await MI_AUTH.init();
  updateAuthHeader();
  if (currentUserId()) {
    const profile = await MI_DB.getProfile(currentUserId());
    if (profile && profile.notifications_enabled) MI_NOTIFY.startListening();
  }
  route();
});
