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

async function enrichWithTmdb(query, expectedType = null, year = null) {
  if (!query || !MI_API.tmdb.ready()) return null;
  const cacheKey = `${query}|${expectedType || ""}|${year || ""}`;
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);
  const result = await MI_API.tmdb.findMedia(query, expectedType, year);
  tmdbCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------- header / nav
function updateAuthHeader() {
  const slot = document.getElementById("auth-slot");
  const headerSlot = document.getElementById("header-auth-slot");
  const userId = currentUserId();
  const uname = currentUsername();

  if (slot) {
    slot.innerHTML = userId
      ? `<button class="icon-btn" id="notif-btn" title="Notifications">🔔</button>
         <span class="hello">${esc(uname)}</span>
         <a href="#/wishlist" class="pill">Wishlist</a>
         <button class="pill ghost" id="logout-btn">Log out</button>`
      : `<button class="pill" id="open-auth">Sign up / Log in</button>`;
  }

  if (headerSlot) {
    headerSlot.innerHTML = userId
      ? `<a href="#/wishlist" class="pill mini-pill" title="Wishlist">★ Wishlist</a>
         <button class="pill ghost mini-pill" id="header-logout-btn" title="Log out">Log out</button>`
      : `<button class="pill primary mini-pill" id="header-open-auth">Log in</button>`;
  }

  if (userId) {
    document.getElementById("logout-btn")?.addEventListener("click", async () => { await MI_AUTH.logout(); updateAuthHeader(); route(); });
    document.getElementById("header-logout-btn")?.addEventListener("click", async () => { await MI_AUTH.logout(); updateAuthHeader(); route(); });
    document.getElementById("notif-btn")?.addEventListener("click", openNotificationsModal);
  } else {
    document.getElementById("open-auth")?.addEventListener("click", () => openAuthModal());
    document.getElementById("header-open-auth")?.addEventListener("click", () => openAuthModal());
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

function openAuthModal(defaultMode = "login") {
  const modalRoot = document.getElementById("modal-root");

  function renderStandardAuth(mode = "login") {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal comic-panel">
          <button class="modal-close" id="modal-close" aria-label="Close modal">&times;</button>
          <div class="tabs">
            <button class="tab ${mode === "login" ? "active" : ""}" data-tab="login">Log in</button>
            <button class="tab ${mode === "signup" ? "active" : ""}" data-tab="signup">Create Account</button>
          </div>
          <div id="auth-notification" style="display:none;margin-bottom:14px;padding:10px 14px;background:#eef8ed;border:2px solid #2e7d32;border-radius:6px;color:#1b5e20;font-size:0.92rem;font-weight:600;"></div>
          <form id="auth-form">
            <div id="username-field" style="display:${mode === "signup" ? "block" : "none"}">
              <label>Username
                <input name="username" ${mode === "signup" ? "required" : ""} autocomplete="username" placeholder="e.g. IronSpidey">
              </label>
            </div>
            <label>Email Address
              <input name="email" type="email" required autocomplete="email" placeholder="you@marvelindia.com">
            </label>
            <label>Password
              <input name="password" type="password" required autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="6" placeholder="At least 6 characters">
            </label>
            <p class="form-error" id="auth-error"></p>
            <button type="submit" class="pill primary full" id="auth-submit-btn">${mode === "login" ? "Log in" : "Create Account"}</button>
          </form>
          <p class="fine-print">Join India's Marvel community to sync watchlists, write reviews, and track release dates.</p>
        </div>
      </div>`;

    let currentMode = mode;
    const form = document.getElementById("auth-form");
    const submitBtn = document.getElementById("auth-submit-btn");
    const usernameWrapper = document.getElementById("username-field");
    const usernameInput = form.querySelector('[name="username"]');
    const noteEl = document.getElementById("auth-notification");

    document.querySelectorAll(".tab").forEach(tabBtn => {
      tabBtn.onclick = () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        currentMode = tabBtn.dataset.tab;
        usernameWrapper.style.display = currentMode === "signup" ? "block" : "none";
        usernameInput.required = currentMode === "signup";
        submitBtn.textContent = currentMode === "login" ? "Log in" : "Create Account";
        document.getElementById("auth-error").textContent = "";
      };
    });

    document.getElementById("modal-close").onclick = closeModal;
    document.getElementById("modal-backdrop").onclick = (e) => {
      if (e.target.id === "modal-backdrop") closeModal();
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = (fd.get("email") || "").trim().toLowerCase();
      const password = fd.get("password");
      const username = (fd.get("username") || "").trim();
      const errEl = document.getElementById("auth-error");
      errEl.textContent = "";

      submitBtn.disabled = true;
      submitBtn.textContent = "Processing…";

      if (currentMode === "login") {
        const result = await MI_AUTH.login(email, password);
        submitBtn.disabled = false;
        submitBtn.textContent = "Log in";
        if (!result.ok) {
          errEl.textContent = result.error || "Unable to log in. Please check your email and password.";
          return;
        }
        closeModal();
        updateAuthHeader();
        route();
      } else {
        const result = await MI_AUTH.signup(username, email, password);
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account";
        if (!result.ok) {
          errEl.textContent = result.error || "Unable to create account. Please try a different email or password.";
          return;
        }
        if (result.needsEmailConfirm) {
          noteEl.textContent = "Account registered successfully! You can now log in with your credentials.";
          noteEl.style.display = "block";
          // switch to login tab
          const loginTab = document.querySelector('.tab[data-tab="login"]');
          if (loginTab) loginTab.click();
        } else {
          closeModal();
          updateAuthHeader();
          route();
        }
      }
    };
  }

  renderStandardAuth(defaultMode);
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

function posterCard(item) {
  let poster = item.poster;
  const title = item.title || item.name || "";
  // Ensure that if poster is missing or a placeholder, we retrieve the verified poster from the catalog
  if ((!poster || poster === "assets/placeholder-poster.svg") && window.MI_ROADMAP) {
    const clean = (title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = window.MI_ROADMAP.find(m => (m.title || "").toLowerCase().replace(/[^a-z0-9]/g, "") === clean);
    if (match && match.poster) poster = match.poster;
  }
  const year = item.year || (item.release_date ? String(item.release_date).slice(0, 4) : "");
  const id = item.id != null ? item.id : (item.tmdb_id || "");
  const safePoster = poster && String(poster).startsWith("http")
    ? poster.replace("http://", "https://")
    : (poster || "assets/placeholder-poster.svg");

  const typeTag = item.type === "series" || item.phase === "series"
    ? "Series"
    : item.type === "xmen" || item.phase === "xmen"
      ? "X-Men"
      : item.status === "upcoming"
        ? "Upcoming"
        : "";

  return `
    <a class="card comic-panel" href="#/movie/${id}">
      <div class="card-poster">
        <img src="${safePoster}" alt="${esc(title)}" loading="lazy"
          onerror="this.onerror=null;this.src='assets/placeholder-poster.svg'">
        ${typeTag ? `<span class="card-type-badge">${typeTag}</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${esc(title)}</h3>
        <span class="muted">${year}</span>
      </div>
    </a>`;
}

// ---------------------------------------------------------------- NAVIGATION HISTORY & BACK BUTTON
const _navHistory = [];
function recordNav(hash) {
  const clean = hash || "#/home";
  if (!_navHistory.length || _navHistory[_navHistory.length - 1] !== clean) {
    _navHistory.push(clean);
    if (_navHistory.length > 40) _navHistory.shift();
  }
}

window.marvelGoBack = function(fallbackHash = "#/home") {
  if (_navHistory.length > 1) {
    _navHistory.pop(); // remove current location
    const prev = _navHistory.pop(); // get previous location
    if (prev && prev !== location.hash) {
      location.hash = prev;
      return;
    }
  }
  if (window.history.length > 1) {
    window.history.back();
    setTimeout(() => {
      if (!location.hash || location.hash === "#" || location.hash === "#/") {
        location.hash = fallbackHash || "#/home";
      }
    }, 200);
    return;
  }
  location.hash = fallbackHash || "#/home";
};

function backButton(fallbackHash = "#/home", label = "Back") {
  return `
    <div class="page-action-bar">
      <a href="${fallbackHash}" class="back-btn" onclick="event.preventDefault(); window.marvelGoBack('${fallbackHash}');" aria-label="${esc(label)}">
        <span class="back-arrow">&larr;</span> ${esc(label)}
      </a>
    </div>`;
}

function renderPrivacyPolicy() {
  app.innerHTML = `
    <section class="section">
      <div class="comic-panel legal-card">
        <h1>Privacy Policy</h1>
        <p class="muted">Last updated: September 2026</p>
        
        <p>Welcome to <strong>Marvel India</strong> (marvelindia.in). Your privacy is important to us. This Privacy Policy outlines the types of information we collect, how it is used, and the steps we take to protect your data.</p>
        
        <h2>1. Information We Collect</h2>
        <p>We collect minimal personal data to provide our fan community features:</p>
        <ul>
          <li><strong>Account Information:</strong> When you register an account, we store your chosen username and email address via Supabase Auth for login authentication.</li>
          <li><strong>User Contributions:</strong> Community blog posts, watch plan checks, wishlist items, and comments you voluntarily submit to the public community.</li>
          <li><strong>Log &amp; Usage Information:</strong> Standard non-personally identifiable log information such as browser type, operating system, referring URLs, and pages visited.</li>
        </ul>

        <h2>2. Cookies, Tracking &amp; Affiliate Disclosure</h2>
        <p>Marvel India maintains an ad-free user experience. We participate in the <strong>Amazon Associates Program</strong>:</p>
        <ul>
          <li><strong>Amazon Associates:</strong> We participate in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by linking to Amazon.in and affiliated sites. When you click Amazon product links, tracking cookies are utilized by Amazon to attribute qualifying purchases.</li>
          <li><strong>No Third-Party Ad Networks:</strong> We do not run Google AdSense or behavioral ad tracking networks on Marvel India.</li>
        </ul>

        <h2>3. Data Protection &amp; User Rights</h2>
        <p>We do not sell, rent, or trade your personal information to third parties. Under applicable privacy regulations (including India's Digital Personal Data Protection Act and GDPR principles), you have the right to request access to, update, or delete your account information at any time by contacting us.</p>

        <h2>4. Contact Us</h2>
        <p>If you have questions regarding this Privacy Policy or data requests, please reach out to the community team at <a href="mailto:contact@marvelindia.in" class="link">contact@marvelindia.in</a>.</p>
        
        <div style="margin-top:28px;">
          <a href="#/home" class="pill primary">← Return to Home</a>
        </div>
      </div>
    </section>
  `;
}

function renderTerms() {
  app.innerHTML = `
    <section class="section">
      <div class="comic-panel legal-card">
        <h1>Terms of Service &amp; Disclaimers</h1>
        <p class="muted">Last updated: September 2026</p>
        
        <h2>1. Fan Community &amp; Fair Use Disclaimer</h2>
        <p><strong>Marvel India</strong> is an independent, non-commercial fan community website created by and for Indian Marvel fans. Marvel India is <strong>not affiliated, associated, authorized, endorsed by, or in any way officially connected</strong> with Marvel Studios, The Walt Disney Company, Sony Pictures, or any of their subsidiaries or affiliates.</p>
        <p>All Marvel characters, names, titles, poster graphics, trailers, and related indicia are registered trademarks and copyright of Marvel Characters, Inc., Marvel Studios, LLC, or their respective copyright owners. All materials presented on this site are for commentary, critique, education, and community entertainment under the Fair Use doctrine.</p>

        <h2>2. Community Guidelines</h2>
        <p>By posting blogs, comments, or participating in discussions:</p>
        <ul>
          <li>Respect your fellow Marvel fans. Hate speech, abusive language, piracy links, and spam are strictly prohibited.</li>
          <li>Do not post unverified spoilers without clear warning tags.</li>
          <li>Accounts violating these terms may have their content removed and posting privileges revoked.</li>
        </ul>

        <h2>3. Affiliate Disclosure</h2>
        <p>In compliance with advertising standards and the Federal Trade Commission (FTC) guidelines:</p>
        <ul>
          <li>Marvel India earns qualifying commissions on purchases made via Amazon product links through the Amazon Associates Program at no additional cost to you.</li>
        </ul>

        <h2>4. Limitation of Liability</h2>
        <p>Release dates, streaming availability on Disney+ Hotstar or other Indian OTT platforms, and runtime listings are curated based on official studio announcements and public metadata APIs. Marvel India makes no guarantees regarding the timing or accuracy of third-party theatrical schedules.</p>

        <div style="margin-top:28px;">
          <a href="#/home" class="pill primary">← Return to Home</a>
        </div>
      </div>
    </section>
  `;
}

async function renderDetailSuggestions(currentMovieId = null, currentBlogSlug = null) {
  const [roadmap, blogs] = await Promise.all([
    MI_DB.getRoadmap().catch(() => []),
    MI_DB.getBlogPosts().catch(() => [])
  ]);

  const cleanCurrent = String(currentMovieId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const allMovies = (roadmap && roadmap.length) ? roadmap : (window.MI_ROADMAP || []);

  const otherMoviesRaw = allMovies
    .filter(m => {
      const mId = String(m.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const mDbId = String(m.db_id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const mNorm = String(m.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return mId !== cleanCurrent && mDbId !== cleanCurrent && mNorm !== cleanCurrent;
    })
    // Only recommend movies that have a verified high-resolution poster (never one without a banner)
    .filter(m => !!m.poster && m.poster !== "assets/placeholder-poster.svg")
    .slice(0, 4);

  const otherMovies = otherMoviesRaw.map(m => ({
    id: m.id,
    title: m.title,
    year: m.year,
    poster: m.poster && String(m.poster).startsWith("http")
      ? m.poster.replace("http://", "https://")
      : m.poster,
    type: m.type
  }));

  const otherBlogs = (blogs || [])
    .filter(b => b.slug !== currentBlogSlug)
    .slice(0, 3);

  return `
    <div class="detail-suggestions-wrap">
      ${otherMovies.length ? `
      <section class="section suggestions-section">
        <div class="section-head">
          <h2>More Marvel Blockbusters</h2>
          <a href="#/roadmap" class="link">Full Roadmap &rarr;</a>
        </div>
        <div class="grid suggestions-grid">
          ${otherMovies.map(posterCard).join("")}
        </div>
      </section>` : ""}

      ${otherBlogs.length ? `
      <section class="section suggestions-section">
        <div class="section-head">
          <h2>From the Community Blog</h2>
          <a href="#/blog" class="link">All Dispatches &rarr;</a>
        </div>
        <div class="home-blog-feed">
          ${otherBlogs.map(homeBlogFeedCard).join("")}
        </div>
      </section>` : ""}
    </div>
  `;
}

// ---------------------------------------------------------------- HOME
async function renderHome() {
  app.innerHTML = `<div class="loading">Assembling the roster…</div>`;

  const [spotlight, roadmap, blogs] = await Promise.all([
    MI_DB.getSpotlightMovie(),
    MI_DB.getRoadmap(),
    MI_DB.getBlogPosts().catch(() => [])
  ]);
  const doom = spotlight || (roadmap && roadmap.find(m => m.status === "upcoming")) || (roadmap && roadmap[roadmap.length - 1]) || { title: "Avengers: Doomsday", release_date: "2026-12-18", tmdb_query: "Avengers Doomsday" };
  const doomTmdb = await enrichWithTmdb(doom.tmdb_query);

  const doomPoster = (() => {
    const p = doomTmdb ? MI_API.tmdb.posterUrl(doomTmdb.poster_path) : null;
    return p ? String(p).replace("http://", "https://") : (doom.poster || "assets/placeholder-poster.svg");
  })();
  const doomBackdrop = (doomTmdb && doomTmdb.backdrop_path) ? MI_API.tmdb.backdropUrl(doomTmdb.backdrop_path) : null;
  const doomOverview = (doomTmdb && doomTmdb.overview) || doom.synopsis || "Victor von Doom rises as the multiverse fractures — Earth's Mightiest Heroes assemble for the ultimate confrontation.";
  const doomRelease = doom.release_date;

  const recent = (roadmap || []).slice(-12).reverse();
  const enriched = await Promise.all(recent.map(async m => {
    const t = await enrichWithTmdb(m.tmdb_query);
    const pp = t ? MI_API.tmdb.posterUrl(t.poster_path) : null;
    return { id: m.id, title: m.title, year: m.year, poster: pp ? String(pp).replace("http://", "https://") : (m.poster || null) };
  }));

  const blogPosts = (blogs || []).slice(0, 6);

  app.innerHTML = `
    <section class="hero" style="${doomBackdrop ? `--hero-bg:url('${doomBackdrop}')` : ""}">
      <div class="hero-inner comic-panel">
        <div class="hero-copy">
          <p class="kicker">The Doomsday Clock is ticking</p>
          <h1>${esc(doom.title)}</h1>
          
          <div class="doom-chronometer-wrap comic-panel">
            <div class="doom-chronometer-header">
              <div class="doom-header-badge">
                <span class="doom-beacon"></span>
                <span class="doom-title-text">LATVERIAN DOOMSDAY CHRONOMETER</span>
              </div>
              <span class="doom-target-pill">IN THEATRES ${fmtDate(doomRelease).toUpperCase()}</span>
            </div>
            
            <div id="doom-countdown" class="doom-countdown-board"></div>
            
            <div class="doom-chronometer-footer">
              <span class="doom-crest">&#9876;</span>
              <span class="doom-footer-text">VICTOR VON DOOM RISES &bull; THE MULTIVERSE COLLIDES</span>
              <span class="doom-crest">&#9876;</span>
            </div>
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

    <!-- BLOGS MOVED ABOVE MOVIES PER USER DIRECTIVE -->
    <section class="section">
      <div class="home-blog-header">
        <div>
          <h2>Community Dispatches &amp; Blog Feed</h2>
          <p class="muted">Fan theories, MCU breakdowns, and release updates from Marvel India.</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <a href="#/blog" class="link">All Articles →</a>
          ${currentUserId() ? `<a href="#/blog/new" class="pill primary">Write a post</a>` : ""}
        </div>
      </div>
      ${blogPosts.length ? `
        <div class="home-blog-feed">
          ${blogPosts.map(homeBlogFeedCard).join("")}
        </div>` : `
        <div class="comic-panel" style="padding:28px;text-align:center;background:var(--paper);">
          <h3 style="margin-bottom:8px;">No community dispatches yet</h3>
          <p class="muted" style="margin-bottom:16px;">Be the first to share an MCU breakdown, theory, or review with fans across India.</p>
          <a href="${currentUserId() ? "#/blog/new" : "#/blog"}" class="pill primary">Share your thoughts</a>
        </div>`}
    </section>

    <!-- MOVIES SECTION -->
    <section class="section">
      <div class="section-head">
        <h2>Marvel, freshly reeled in</h2>
        <a href="#/search" class="link">Search everything →</a>
      </div>
      <div class="grid">${enriched.map(posterCard).join("")}</div>
    </section>

    <section class="section quicklinks">
      <a class="quick comic-panel" href="#/timeline"><h3>MCU Timeline</h3><p>The story in chronological order, movie by movie.</p></a>
      <a class="quick comic-panel" href="#/roadmap"><h3>Watch Plan</h3><p>MCU release schedule and complete phase checklist.</p></a>
      <a class="quick comic-panel" href="#/blog"><h3>Blog</h3><p>Fan theories, reviews and news from the community.</p></a>
      <a class="quick comic-panel" href="#/shop"><h3>Shop</h3><p>Merch we love, via Amazon.</p></a>
    </section>
  `;
  startCountdown(doomRelease);
}

function homeBlogFeedCard(p) {
  const author = esc(p.profiles ? p.profiles.username : "Contributor");
  const date = fmtDate(p.created_at);
  const excerpt = esc(p.body ? p.body.replace(/\s+/g, " ").slice(0, 160) + (p.body.length > 160 ? "…" : "") : "");
  const cover = p.cover_image_url ? String(p.cover_image_url).replace("http://", "https://") : "";
  return `
    <article class="feed-post-card comic-panel">
      ${cover ? `<div class="feed-post-cover" style="background-image:url('${cover}')"></div>` : ""}
      <div class="feed-post-body">
        <div class="feed-post-meta">BY ${author.toUpperCase()} &bull; ${date.toUpperCase()}</div>
        <h3 class="feed-post-title"><a href="#/blog/${p.slug}" style="text-decoration:none;color:inherit;">${esc(p.title)}</a></h3>
        <p class="feed-post-excerpt">${excerpt}</p>
        <div class="feed-post-footer">
          <div class="tag-row">${(p.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          <a href="#/blog/${p.slug}" class="feed-read-more">Read &rarr;</a>
        </div>
      </div>
    </article>`;
}

// Notice helper (kept harmlessly in case of external call)
function supabaseNotConfiguredNotice() {
  return "";
}

function startCountdown(targetDateStr) {
  const box = document.getElementById("doom-countdown");
  if (!box) return;
  const target = new Date(targetDateStr || "2026-12-18").getTime();
  function tick() {
    const diff = target - Date.now();
    if (isNaN(target) || diff <= 0) {
      box.innerHTML = `<div class="doom-zero-hour">DOOMSDAY HAS ARRIVED &bull; DESTINY FULFILLED</div>`;
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    box.innerHTML = `
      <div class="doom-flip-cell">
        <div class="doom-flip-card">
          <span class="doom-num">${d}</span>
          <div class="doom-flip-split"></div>
        </div>
        <span class="doom-unit">DAYS</span>
      </div>
      <div class="doom-colon">:</div>
      <div class="doom-flip-cell">
        <div class="doom-flip-card">
          <span class="doom-num">${String(h).padStart(2, "0")}</span>
          <div class="doom-flip-split"></div>
        </div>
        <span class="doom-unit">HOURS</span>
      </div>
      <div class="doom-colon">:</div>
      <div class="doom-flip-cell">
        <div class="doom-flip-card">
          <span class="doom-num">${String(m).padStart(2, "0")}</span>
          <div class="doom-flip-split"></div>
        </div>
        <span class="doom-unit">MINS</span>
      </div>
      <div class="doom-colon">:</div>
      <div class="doom-flip-cell doom-sec-cell">
        <div class="doom-flip-card doom-sec-card">
          <span class="doom-num doom-pulse-sec">${String(s).padStart(2, "0")}</span>
          <div class="doom-flip-split"></div>
        </div>
        <span class="doom-unit">SECS</span>
      </div>`;
  }
  tick();
  if (window._doomInterval) clearInterval(window._doomInterval);
  window._doomInterval = setInterval(tick, 1000);
}

// ---------------------------------------------------------------- SEARCH (Default Movies & Infinite Scroll)
async function renderSearch(query) {
  const SUGGESTIONS = [
    "Spider-Man", "Iron Man", "Avengers", "Thor", "Black Panther", "Doctor Strange",
    "Guardians of the Galaxy", "Captain America", "Loki", "WandaVision", "Deadpool",
    "X-Men", "Fantastic Four", "Ant-Man", "Shang-Chi", "Eternals", "Hawkeye", "Daredevil", "Wolverine", "Doomsday"
  ];

  function norm(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  app.innerHTML = `
    ${backButton("#/home", "Back to Home")}
    <section class="section search-section">
      <div class="search-hero comic-panel">
        <div class="search-hero-head">
          <span class="search-eyebrow">MARVEL ARCHIVES &middot; MULTIVERSE SEARCH</span>
          <h1>Search Marvel Movies &amp; Series</h1>
          <p class="search-sub">Explore across 75+ MCU blockbusters, Disney+ streaming series, X-Men sagas, and Phase 6 releases.</p>
        </div>

        <form id="search-form" class="search-bar-unified">
          <div class="search-input-wrap">
            <span class="search-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input name="q" id="search-input" placeholder="Search by title (e.g. Deadpool, Loki, Avengers, X-Men)..." value="${esc(query || "")}" autocomplete="off">
            ${query ? `<a href="#/search" class="search-clear-btn" title="Clear search">&times;</a>` : ""}
            <div class="search-suggestions" id="search-suggestions" hidden></div>
          </div>
          <button class="pill primary search-submit-btn" type="submit">Search</button>
        </form>

        <div class="quick-tags-wrap">
          <span class="quick-tag-label">Trending:</span>
          <a href="#/search?q=Avengers" class="quick-tag">Avengers</a>
          <a href="#/search?q=Loki" class="quick-tag">Loki</a>
          <a href="#/search?q=Deadpool" class="quick-tag">Deadpool</a>
          <a href="#/search?q=Spider-Man" class="quick-tag">Spider-Man</a>
          <a href="#/search?q=X-Men" class="quick-tag">X-Men</a>
          <a href="#/search?q=Doomsday" class="quick-tag">Doomsday</a>
          <a href="#/search?q=Wolverine" class="quick-tag">Wolverine</a>
        </div>
      </div>

      <div class="search-nav-row">
        <div class="filter-bar" id="search-filter-bar">
          <button type="button" class="filter-btn active" data-filter="all">All Titles <span class="filter-count" id="count-all"></span></button>
          <button type="button" class="filter-btn" data-filter="movie">Movies <span class="filter-count" id="count-movie"></span></button>
          <button type="button" class="filter-btn" data-filter="series">Web Series <span class="filter-count" id="count-series"></span></button>
          <button type="button" class="filter-btn" data-filter="xmen">X-Men <span class="filter-count" id="count-xmen"></span></button>
          <button type="button" class="filter-btn" data-filter="upcoming">Upcoming <span class="filter-count" id="count-upcoming"></span></button>
        </div>
        <div class="search-counter-badge" id="search-status-bar">
          Loading Marvel archive…
        </div>
      </div>

      <div id="search-grid" class="grid"></div>

      <div id="search-infinite-sentinel" class="infinite-scroll-status">
        <div class="infinite-spinner" id="infinite-spinner"></div>
        <span id="infinite-status-text">Loading more titles…</span>
        <button type="button" class="pill ghost load-more-btn" id="manual-load-more-btn" style="display:none;">Load More Titles</button>
      </div>
    </section>`;

  const input = document.getElementById("search-input");
  const sugBox = document.getElementById("search-suggestions");
  const grid = document.getElementById("search-grid");
  const sentinel = document.getElementById("search-infinite-sentinel");
  const spinner = document.getElementById("infinite-spinner");
  const statusText = document.getElementById("infinite-status-text");
  const manualLoadBtn = document.getElementById("manual-load-more-btn");
  const statusBar = document.getElementById("search-status-bar");
  const filterBar = document.getElementById("search-filter-bar");
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
    if (!e.target.closest(".search-wrap") && !e.target.closest(".search-bar-unified")) {
      sugBox.hidden = true;
    }
  }, { once: false });

  document.getElementById("search-form").onsubmit = (e) => {
    e.preventDefault();
    sugBox.hidden = true;
    const q = new FormData(e.target).get("q").trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : `#/search`;
  };

  // Base Marvel catalogue from Roadmap
  const roadmap = await MI_DB.getRoadmap().catch(() => []);
  const baseCatalog = (roadmap && roadmap.length) ? roadmap : (window.MI_ROADMAP || []);
  let masterList = [];

  if (query) {
    let tmdbResults = [];
    if (MI_API.tmdb.ready()) {
      try {
        const data = await MI_API.tmdb.search(query);
        tmdbResults = (data && data.results || [])
          .filter(r => r.media_type === "movie" || r.media_type === "tv")
          .map(r => ({
            id: (r.media_type === "tv" ? "tmdb-tv-" : "tmdb-movie-") + r.id,
            tmdb_id: r.id,
            media_type: r.media_type,
            title: r.title || r.name,
            year: (r.release_date || r.first_air_date || "").slice(0, 4),
            poster: MI_API.tmdb.posterUrl(r.poster_path),
            type: r.media_type === "tv" ? "series" : "movie",
            status: "released"
          }));
      } catch (err) {
        console.warn("TMDB search error:", err);
      }
    }

    const qLower = query.toLowerCase();
    const qKey = norm(query);

    const localMatches = baseCatalog.filter(m => {
      const t = (m.title || "").toLowerCase();
      const syn = (m.synopsis || "").toLowerCase();
      const ph = (m.phase || "").toLowerCase();
      const sg = (m.saga || "").toLowerCase();
      return t.includes(qLower) || syn.includes(qLower) || ph.includes(qLower) || sg.includes(qLower) || norm(m.title).includes(qKey);
    });

    const seenMap = new Map();
    // Add local matches first (always have high-res verified posters)
    localMatches.forEach(m => {
      seenMap.set(norm(m.title), m);
    });

    // Merge TMDB results only if not already matched
    tmdbResults.forEach(r => {
      const key = norm(r.title);
      if (!seenMap.has(key)) {
        seenMap.set(key, r);
      }
    });

    masterList = Array.from(seenMap.values());
  } else {
    // Default: all titles strictly deduplicated
    const seenMap = new Map();
    baseCatalog.forEach(m => {
      const key = norm(m.title);
      if (!seenMap.has(key)) {
        seenMap.set(key, m);
      }
    });
    masterList = Array.from(seenMap.values());
  }

  // Calculate category counts
  const countAll = masterList.length;
  const countMovies = masterList.filter(m => m.type === "movie" || (!m.type && m.phase !== "series" && m.phase !== "xmen")).length;
  const countSeries = masterList.filter(m => m.type === "series" || m.phase === "series").length;
  const countXmen = masterList.filter(m => m.type === "xmen" || m.phase === "xmen" || (m.title && m.title.toLowerCase().includes("x-men")) || (m.title && m.title.toLowerCase().includes("wolverine")) || (m.title && m.title.toLowerCase().includes("deadpool"))).length;
  const countUpcoming = masterList.filter(m => m.status === "upcoming" || m.year >= 2025).length;

  const elCountAll = document.getElementById("count-all");
  const elCountMovies = document.getElementById("count-movie");
  const elCountSeries = document.getElementById("count-series");
  const elCountXmen = document.getElementById("count-xmen");
  const elCountUpcoming = document.getElementById("count-upcoming");

  if (elCountAll) elCountAll.textContent = countAll;
  if (elCountMovies) elCountMovies.textContent = countMovies;
  if (elCountSeries) elCountSeries.textContent = countSeries;
  if (elCountXmen) elCountXmen.textContent = countXmen;
  if (elCountUpcoming) elCountUpcoming.textContent = countUpcoming;

  let activeFilter = "all";
  let filteredItems = masterList;
  let displayedCount = 0;
  const BATCH_SIZE = 12;
  let isLoadingBatch = false;

  function applyFilter(f) {
    activeFilter = f;
    filterBar.querySelectorAll(".filter-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === f);
    });

    if (f === "all") {
      filteredItems = masterList;
    } else if (f === "movie") {
      filteredItems = masterList.filter(m => m.type === "movie" || (!m.type && m.phase !== "series" && m.phase !== "xmen"));
    } else if (f === "series") {
      filteredItems = masterList.filter(m => m.type === "series" || m.phase === "series");
    } else if (f === "xmen") {
      filteredItems = masterList.filter(m => m.type === "xmen" || m.phase === "xmen" || (m.title && m.title.toLowerCase().includes("x-men")) || (m.title && m.title.toLowerCase().includes("wolverine")) || (m.title && m.title.toLowerCase().includes("deadpool")));
    } else if (f === "upcoming") {
      filteredItems = masterList.filter(m => m.status === "upcoming" || m.year >= 2025);
    }

    grid.innerHTML = "";
    displayedCount = 0;

    if (filteredItems.length === 0) {
      grid.innerHTML = `
        <div class="search-empty-state comic-panel" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #fff;">
          <h3 style="font-size: 1.4rem; margin-bottom: 8px;">No Marvel titles found</h3>
          <p class="muted" style="margin-bottom: 20px;">We couldn't find any results matching "${esc(query || activeFilter)}".</p>
          <a href="#/search" class="pill primary">Reset &amp; View All Marvel Titles</a>
        </div>`;
      statusBar.textContent = "0 titles found";
      sentinel.style.display = "none";
      return;
    }

    statusBar.textContent = `Showing ${Math.min(BATCH_SIZE, filteredItems.length)} of ${filteredItems.length} titles`;
    sentinel.style.display = "flex";
    loadNextBatch();
  }

  async function loadNextBatch() {
    if (isLoadingBatch) return;
    if (displayedCount >= filteredItems.length) {
      spinner.style.display = "none";
      manualLoadBtn.style.display = "none";
      statusText.textContent = `You've reached the end of the archive (${filteredItems.length} titles).`;
      return;
    }

    isLoadingBatch = true;
    spinner.style.display = "block";
    statusText.textContent = "Loading more titles…";

    const nextSlice = filteredItems.slice(displayedCount, displayedCount + BATCH_SIZE);
    displayedCount += nextSlice.length;

    const enrichedSlice = await Promise.all(nextSlice.map(async item => {
      let p = item.poster;
      if (!p && item.tmdb_query) {
        const tm = await enrichWithTmdb(item.tmdb_query).catch(() => null);
        if (tm && tm.poster_path) p = MI_API.tmdb.posterUrl(tm.poster_path);
      }
      return { ...item, poster: p || "assets/placeholder-poster.svg" };
    }));

    const html = enrichedSlice.map(posterCard).join("");
    grid.insertAdjacentHTML("beforeend", html);

    statusBar.textContent = `Showing ${displayedCount} of ${filteredItems.length} titles`;
    isLoadingBatch = false;

    if (displayedCount >= filteredItems.length) {
      spinner.style.display = "none";
      manualLoadBtn.style.display = "none";
      statusText.textContent = `End of archive (${filteredItems.length} titles).`;
    } else {
      spinner.style.display = "none";
      manualLoadBtn.style.display = "inline-flex";
      statusText.textContent = `Scroll down or tap "Load More" to load next batch.`;
    }
  }

  filterBar.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => applyFilter(btn.dataset.filter);
  });

  manualLoadBtn.onclick = () => loadNextBatch();

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoadingBatch && displayedCount < filteredItems.length) {
          loadNextBatch();
        }
      });
    }, { rootMargin: "300px 0px" });

    observer.observe(sentinel);
  }

  applyFilter("all");
}

// ---------------------------------------------------------------- MOVIE DETAIL
async function renderMovie(id) {
  app.innerHTML = `<div class="loading">Pulling up the file…</div>`;

  const rawId = String(id || "").trim();
  let dbMovie = null;
  let tmdbId = null;
  let mediaType = "movie";

  if (rawId.startsWith("tmdb-tv-")) {
    tmdbId = rawId.replace("tmdb-tv-", "");
    mediaType = "tv";
  } else if (rawId.startsWith("tmdb-movie-")) {
    tmdbId = rawId.replace("tmdb-movie-", "");
    mediaType = "movie";
  } else if (rawId.startsWith("tmdb-")) {
    tmdbId = rawId.replace("tmdb-", "");
    mediaType = "unknown";
  } else {
    dbMovie = await MI_DB.getMovie(rawId);
  }

  let tmdbFull = null;

  if (dbMovie) {
    const isTv = dbMovie.type === "series" || dbMovie.phase === "series";
    mediaType = isTv ? "tv" : "movie";

    if (dbMovie.tmdb_query) {
      const found = await enrichWithTmdb(dbMovie.tmdb_query, mediaType, dbMovie.year);
      if (found) {
        // Guard against matching a completely different movie: verify title similarity
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const foundTitle = norm(found.title || found.name);
        const movieTitle = norm(dbMovie.title);
        const isMatch = foundTitle === movieTitle ||
          foundTitle.includes(movieTitle.slice(0, 5)) ||
          movieTitle.includes(foundTitle.slice(0, 5));
        if (isMatch) {
          tmdbId = found.id;
          if (found.media_type) mediaType = found.media_type;
        }
      }
    }
  }

  if (tmdbId && MI_API.tmdb.ready()) {
    tmdbFull = await MI_API.tmdb.mediaDetails(tmdbId, mediaType);
    if (tmdbFull && mediaType === "unknown" && tmdbFull.media_type) {
      mediaType = tmdbFull.media_type;
    }
  }

  const isSeries = mediaType === "tv" || (dbMovie && (dbMovie.type === "series" || dbMovie.phase === "series"));
  const title = (dbMovie && dbMovie.title) || (tmdbFull && (tmdbFull.title || tmdbFull.name)) || "Untitled";
  const overview = (tmdbFull && tmdbFull.overview) || (dbMovie && dbMovie.synopsis) || "";
  const releaseDate = (tmdbFull && (tmdbFull.release_date || tmdbFull.first_air_date)) || (dbMovie && dbMovie.release_date);
  const runtime = (tmdbFull && (tmdbFull.runtime || (tmdbFull.episode_run_time && tmdbFull.episode_run_time[0]))) || (dbMovie && dbMovie.runtime_minutes);
  const posterRaw = (dbMovie && dbMovie.poster && dbMovie.poster !== "assets/placeholder-poster.svg")
    ? dbMovie.poster
    : (tmdbFull && tmdbFull.poster_path ? MI_API.tmdb.posterUrl(tmdbFull.poster_path) : "assets/placeholder-poster.svg");
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
  const suggestionsHtml = await renderDetailSuggestions(id, null);

  app.innerHTML = `
    ${backButton("#/roadmap", "Back to movies")}

    <section class="detail" style="${backdrop ? `--hero-bg:url('${backdrop}')` : ""}">
      <div class="detail-inner comic-panel">
        <div class="detail-copy">
          <h1>${esc(title)}</h1>
          <p class="muted">${fmtDate(releaseDate)} ${runtime ? `· ${fmtMinutes(runtime)}` : (tmdbFull && tmdbFull.number_of_seasons ? `· ${tmdbFull.number_of_seasons} Season${tmdbFull.number_of_seasons > 1 ? "s" : ""}` : "")} ${genres.length ? "· " + genres.map(g => g.name).join(", ") : ""}</p>
          ${dbMovie && dbMovie.priority ? `<p class="tag">${dbMovie.priority.replace("-", " ")}</p>` : (isSeries ? `<p class="tag">Series</p>` : "")}
          <div class="ratings">
            ${tmdbFull && tmdbFull.vote_average ? `<span class="badge">★ ${tmdbFull.vote_average.toFixed(1)}/10 Audience Rating</span>` : ""}
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

    <!-- SUGGESTIONS: OTHER MOVIES & BLOGS -->
    ${suggestionsHtml}
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
  if (!flat.length) return `<p class="muted">Streaming availability details will appear here as provider updates occur.</p>`;
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
  const items = await MI_DB.getTimeline();

  function getTimelineRealm(t) {
    const title = (t.movie_title || "").toLowerCase();
    const blurb = (t.blurb || "").toLowerCase();
    if (title.includes("x-men") || title.includes("wolverine") || title.includes("deadpool") || title.includes("first class") || title.includes("days of future past") || title.includes("logan") || blurb.includes("mutant")) {
      return { realm: "mutants", label: "Mutant Universe", tagClass: "tag-xmen" };
    }
    if (title.includes("loki") || title.includes("multiverse") || title.includes("what if") || title.includes("secret wars") || blurb.includes("tva") || blurb.includes("timeline")) {
      return { realm: "multiverse", label: "Multiverse / TVA", tagClass: "tag-multiverse" };
    }
    return { realm: "sacred", label: "Sacred Timeline", tagClass: "tag-sacred" };
  }

  app.innerHTML = `
    ${backButton("#/home", "Back to Home")}
    <section class="section timeline-section">
      <h1>Marvel Universe Timeline</h1>
      <p class="muted">In-universe chronological order — spanning the Sacred MCU Timeline, Fox Mutant Era, and Multiverse TVA incursions.</p>
      
      <div class="filter-bar" id="timeline-filter-bar">
        <button type="button" class="filter-btn active" data-timeline-filter="all">All Chronological (${items.length})</button>
        <button type="button" class="filter-btn" data-timeline-filter="sacred">Sacred Timeline</button>
        <button type="button" class="filter-btn" data-timeline-filter="mutants">Mutants &amp; X-Men</button>
        <button type="button" class="filter-btn" data-timeline-filter="multiverse">Multiverse / TVA</button>
      </div>

      <div class="timeline" id="timeline-list">
        ${items.map(i => {
          const r = getTimelineRealm(i);
          return `
          <div class="timeline-item ${i.spotlight ? "spotlight" : ""}" data-realm="${r.realm}">
            <div class="timeline-year">${esc(i.year_label)}</div>
            <div class="timeline-card comic-panel">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                <h3 style="margin:0;">${esc(i.movie_title)}</h3>
                <span class="tag ${r.tagClass}">${r.label}</span>
              </div>
              <p style="margin:0;">${esc(i.blurb)}</p>
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>`;

  const filterBar = document.getElementById("timeline-filter-bar");
  filterBar.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
      const f = btn.dataset.timelineFilter;
      filterBar.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll("#timeline-list .timeline-item").forEach(el => {
        if (f === "all" || el.dataset.realm === f) {
          el.style.display = "";
        } else {
          el.style.display = "none";
        }
      });
    };
  });
}

// ---------------------------------------------------------------- ROADMAP (+ Doomsday watch plan)
async function renderRoadmap() {
  app.innerHTML = `<div class="loading">Building your roadmap…</div>`;
  const userId = currentUserId();
  const [roadmap, watchedIds, doom] = await Promise.all([MI_DB.getRoadmap(), MI_DB.getWatchedIds(userId), MI_DB.getSpotlightMovie()]);
  const watchedSet = new Set(watchedIds);

  const byPhase = {};
  const phaseMeta = {
    phase1: { label: "Phase One", saga: "Infinity Saga", years: "2008–2012", category: "infinity" },
    phase2: { label: "Phase Two", saga: "Infinity Saga", years: "2013–2015", category: "infinity" },
    phase3: { label: "Phase Three", saga: "Infinity Saga", years: "2016–2019", category: "infinity" },
    phase4: { label: "Phase Four", saga: "Multiverse Saga", years: "2021–2022", category: "multiverse" },
    phase5: { label: "Phase Five", saga: "Multiverse Saga", years: "2023–2025", category: "multiverse" },
    phase6: { label: "Phase Six", saga: "Multiverse Saga", years: "2026–2027", category: "multiverse" },
    series: { label: "Disney+ Web Series & Specials", saga: "Marvel Television", years: "2021–Present", category: "series" },
    xmen: { label: "Mutant Saga & X-Men Archive", saga: "Fox-Marvel Universe", years: "2000–2024+", category: "xmen" }
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
  const minutesPerDayMust = daysLeft ? Math.ceil(remainingMinutesMustWatch / daysLeft) : 0;

  app.innerHTML = `
    ${backButton("#/home", "Back to Home")}
    <section class="section">
      <h1>Marvel Roadmap &amp; Checklist</h1>
      <p class="muted">Every MCU film, Disney+ web series, and X-Men project. Check off what you've watched — ${userId ? "saved to your account" : "log in to save your progress"}.</p>

      <div class="watch-plan comic-panel">
        <h2>Doomsday Watch Plan</h2>
        ${doom ? `
        <div class="watch-plan-stats">
          <div><strong>${daysLeft}</strong><span>days until ${esc(doom.title)}</span></div>
          <div><strong>${unwatched.length}</strong><span>unwatched titles</span></div>
          <div><strong>${fmtMinutes(remainingMinutesAll)}</strong><span>total remaining runtime</span></div>
          <div><strong>${fmtMinutes(remainingMinutesMustWatch)}</strong><span>must-watch remaining</span></div>
          <div><strong>~${fmtMinutes(minutesPerDayMust)}</strong><span>per day to finish must-watch in time</span></div>
        </div>
        ${!userId ? `<p class="notice">Log in so your watched list (and this plan) is personal to you.</p>` : ""}
        ` : `<p class="muted">Avengers: Doomsday release date is set to power this calculator.</p>`}
      </div>

      <div class="filter-bar" id="roadmap-filter-bar">
        <button type="button" class="filter-btn active" data-roadmap-filter="all">All Marvel Projects</button>
        <button type="button" class="filter-btn" data-roadmap-filter="infinity">Infinity Saga</button>
        <button type="button" class="filter-btn" data-roadmap-filter="multiverse">Multiverse Saga</button>
        <button type="button" class="filter-btn" data-roadmap-filter="series">Disney+ Web Series</button>
        <button type="button" class="filter-btn" data-roadmap-filter="xmen">X-Men Universe</button>
      </div>

      <div id="roadmap-phases-container">
      ${Object.keys(phaseMeta).map(phaseId => {
        const movies = byPhase[phaseId] || [];
        if (!movies.length) return "";
        const meta = phaseMeta[phaseId];
        return `
        <div class="phase-block" data-phase-category="${meta.category}">
          <h2>${meta.label} <span class="muted">· ${meta.saga} · ${meta.years}</span></h2>
          <ul class="roadmap-list">
            ${movies.map(m => {
              const itemType = m.type || (m.phase === "series" ? "series" : m.phase === "xmen" ? "x-men" : "movie");
              return `
              <li class="${watchedSet.has(m.id) ? "done" : ""} ${m.status === "upcoming" ? "upcoming" : ""}" data-id="${m.id}">
                <label>
                  <input type="checkbox" data-id="${m.id}" ${watchedSet.has(m.id) ? "checked" : ""} ${m.status === "upcoming" ? "disabled" : ""}>
                  <span><a href="#/movie/${m.id}">${esc(m.title)}</a> <em class="muted">(${m.year})</em></span>
                </label>
                <span class="roadmap-meta">
                  <span class="tag tag-type">${itemType.toUpperCase()}</span>
                  <span class="tag priority-${m.priority}">${m.priority.replace("-", " ")}</span>
                  <span class="muted">${fmtMinutes(m.runtime_minutes)}</span>
                  ${m.status === "upcoming" ? `<span class="tag upcoming-tag">Upcoming</span>` : ""}
                </span>
              </li>`;
            }).join("")}
          </ul>
        </div>`;
      }).join("")}
      </div>
    </section>`;

  const filterBar = document.getElementById("roadmap-filter-bar");
  filterBar.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
      const f = btn.dataset.roadmapFilter;
      filterBar.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll("#roadmap-phases-container .phase-block").forEach(block => {
        if (f === "all" || block.dataset.phaseCategory === f) {
          block.style.display = "";
        } else {
          block.style.display = "none";
        }
      });
    };
  });

  app.querySelectorAll('input[type=checkbox][data-id]').forEach(cb => {
    cb.onchange = async () => {
      if (!userId) { cb.checked = !cb.checked; openAuthModal(); return; }
      await MI_DB.toggleWatched(userId, cb.dataset.id, cb.checked);
      renderRoadmap();
    };
  });
}

// ---------------------------------------------------------------- WISHLIST
async function renderWishlist() {
  const userId = currentUserId();
  if (!userId) { openAuthModal(); location.hash = "#/home"; return; }
  app.innerHTML = `<div class="loading">Loading your wishlist…</div>`;
  const list = await MI_DB.getWishlist(userId);
  app.innerHTML = `
    ${backButton("#/home", "Back to Home")}
    <section class="section">
      <h1>${esc(currentUsername())}'s wishlist</h1>
      ${list.length ? `<div class="grid">${list.map(i => posterCard({ id: i.item_id, title: i.title, year: "", poster: i.poster_url })).join("")}</div>`
        : `<p class="muted">Nothing saved yet — open any title and tap "Add to wishlist".</p>`}
    </section>`;
}

// ---------------------------------------------------------------- BLOG
async function renderBlogList() {
  app.innerHTML = `<div class="loading">Loading posts…</div>`;
  const posts = await MI_DB.getBlogPosts();
  const userId = currentUserId();
  app.innerHTML = `
    ${backButton("#/home", "Back to Home")}
    <section class="section">
      <div class="section-head">
        <h1>Blog</h1>
        ${userId ? `<a href="#/blog/new" class="pill primary">Write a post</a>` : `<button class="pill" id="blog-login-btn">Log in to write</button>`}
      </div>
      ${posts.length ? `<div class="blog-grid">${posts.map(blogCard).join("")}</div>` : `<p class="muted">No posts yet — be the first to write one.</p>`}
    </section>
  `;
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
  const post = await MI_DB.getBlogPost(slug);
  if (!post) { app.innerHTML = `<section class="section">${backButton("#/blog", "Back to Blog")}<h1>Post not found</h1></section>`; return; }
  const userId = currentUserId();
  const comments = await MI_DB.getBlogComments(post.id);
  const suggestionsHtml = await renderDetailSuggestions(null, slug);
  app.innerHTML = `
    ${backButton("#/blog", "Back to Blog")}
    <section class="section">
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
    </section>

    <!-- SUGGESTIONS: OTHER BLOGS & MOVIES -->
    ${suggestionsHtml}
  `;
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
    ${backButton("#/blog", "Back to Blog")}
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
  const products = await MI_DB.getAffiliateProducts();
  const tag = window.MARVEL_INDIA_CONFIG.AMAZON_AFFILIATE_TAG;
  app.innerHTML = `
    ${backButton("#/home", "Back to Home")}
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
  recordNav(location.hash || "#/home");
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
  if (path === "/characters" || path.startsWith("/character/")) {
    location.hash = "#/home";
    return;
  }
  if (path === "/wishlist") return renderWishlist();
  if (path === "/blog") return renderBlogList();
  if (path === "/blog/new") return renderNewBlogForm();
  if (path.startsWith("/blog/")) return renderBlogPost(path.split("/")[2]);
  if (path === "/shop") return renderShop();
  if (path === "/privacy") return renderPrivacyPolicy();
  if (path === "/terms") return renderTerms();
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
