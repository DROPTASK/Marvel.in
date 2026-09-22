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
  try {
    if (!query || !window.MI_API || !window.MI_API.tmdb || !window.MI_API.tmdb.ready || !window.MI_API.tmdb.ready()) return null;
    const cacheKey = `${query}|${expectedType || ""}|${year || ""}`;
    if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3000));
    const fetchPromise = window.MI_API.tmdb.findMedia(query, expectedType, year);
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    if (result) tmdbCache.set(cacheKey, result);
    return result || null;
  } catch (err) {
    console.warn("[MarvelIndia] enrichWithTmdb fallback:", query, err);
    return null;
  }
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
  if (!history.state || !history.state.miModal) {
    history.pushState({ miModal: true }, "");
  }
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

function openAuthModal(defaultMode = "login", initialEmail = "") {
  const modalRoot = document.getElementById("modal-root");
  let currentResendTimer = null;

  if (!history.state || !history.state.miModal) {
    history.pushState({ miModal: true }, "");
  }

  function closeModal() {
    if (currentResendTimer) {
      clearInterval(currentResendTimer);
      currentResendTimer = null;
    }
    modalRoot.innerHTML = "";
    if (history.state && history.state.miModal) {
      history.back();
    }
  }

  function renderStandardAuth(mode = "login", prefillEmail = "", prefillUsername = "") {
    if (currentResendTimer) {
      clearInterval(currentResendTimer);
      currentResendTimer = null;
    }

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
                <input name="username" value="${esc(prefillUsername)}" ${mode === "signup" ? "required" : ""} autocomplete="username" placeholder="e.g. IronSpidey">
              </label>
            </div>
            <label>Email Address
              <input name="email" type="email" value="${esc(prefillEmail)}" required autocomplete="email" placeholder="you@marvelindia.com">
            </label>
            <label>Password
              <input name="password" type="password" required autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="6" placeholder="At least 6 characters">
            </label>
            <p class="form-error" id="auth-error"></p>
            <button type="submit" class="pill primary full" id="auth-submit-btn">${mode === "login" ? "Log in" : "Continue &rarr;"}</button>
          </form>
          <p class="fine-print">Join India's Marvel community to sync watchlists, write reviews, and track release dates.</p>
        </div>
      </div>`;

    let currentMode = mode;
    const form = document.getElementById("auth-form");
    const submitBtn = document.getElementById("auth-submit-btn");
    const usernameWrapper = document.getElementById("username-field");
    const usernameInput = form.querySelector('[name="username"]');
    const emailInput = form.querySelector('[name="email"]');
    const errEl = document.getElementById("auth-error");

    document.querySelectorAll(".tab").forEach(tabBtn => {
      tabBtn.onclick = () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        currentMode = tabBtn.dataset.tab;
        usernameWrapper.style.display = currentMode === "signup" ? "block" : "none";
        usernameInput.required = currentMode === "signup";
        submitBtn.textContent = currentMode === "login" ? "Log in" : "Continue →";
        errEl.textContent = "";
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
      errEl.textContent = "";

      submitBtn.disabled = true;
      submitBtn.textContent = "Processing…";

      if (currentMode === "login") {
        const result = await MI_AUTH.login(email, password);
        submitBtn.disabled = false;
        submitBtn.textContent = "Log in";
        if (!result.ok) {
          const errText = result.error || "Unable to log in. Please check your email and password.";
          errEl.textContent = errText;
          if (errText.toLowerCase().includes("confirm") || errText.toLowerCase().includes("not verified")) {
            errEl.innerHTML = `${esc(errText)} <br><button type="button" id="login-goto-otp" class="link-btn" style="color:var(--marvel-red);text-decoration:underline;margin-top:6px;font-weight:700;">Enter verification code &rarr;</button>`;
            document.getElementById("login-goto-otp")?.addEventListener("click", () => {
              renderOtpStep(email, "");
            });
          }
          return;
        }
        closeModal();
        updateAuthHeader();
        route();
      } else {
        const result = await MI_AUTH.signup(username, email, password);
        submitBtn.disabled = false;
        submitBtn.textContent = "Continue →";
        if (!result.ok) {
          errEl.textContent = result.error || "Unable to create account. Please try a different email or password.";
          return;
        }
        // User starts registration -> continues -> inline OTP screen appears!
        if (result.needsEmailConfirm) {
          renderOtpStep(email, username);
        } else {
          closeModal();
          updateAuthHeader();
          route();
        }
      }
    };
  }

  function renderOtpStep(email, username = "") {
    if (currentResendTimer) {
      clearInterval(currentResendTimer);
      currentResendTimer = null;
    }

    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal comic-panel modal-otp-step" style="max-width:440px;">
          <button class="modal-close" id="modal-close" aria-label="Close modal">&times;</button>
          
          <div style="text-align:center;margin-bottom:14px;">
            <div class="otp-crest-wrap" style="margin-bottom:8px;">
              <div class="otp-crest" style="width:46px;height:46px;font-size:1.3rem;">⚡</div>
            </div>
            <h2 style="font-family:'Anton',sans-serif;font-size:1.6rem;letter-spacing:0.04em;margin:0 0 6px;color:var(--ink);">Verify Your Email</h2>
            <p style="color:var(--muted);font-size:0.92rem;margin:0 0 4px;line-height:1.4;">
              We sent a 6-digit confirmation code to<br>
              <strong style="color:var(--ink);">${esc(email || "your email")}</strong>
              <button type="button" id="modal-otp-change-email" class="link-btn" style="margin-left:6px;font-size:0.85rem;color:var(--marvel-red);text-decoration:underline;">(Change)</button>
            </p>
          </div>

          <form id="modal-otp-form">
            <div class="otp-digit-group" id="modal-digit-group" style="margin-bottom:10px;">
              <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit-box" data-idx="0" autocomplete="one-time-code" autofocus>
              <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit-box" data-idx="1" autocomplete="off">
              <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit-box" data-idx="2" autocomplete="off">
              <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit-box" data-idx="3" autocomplete="off">
              <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit-box" data-idx="4" autocomplete="off">
              <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit-box" data-idx="5" autocomplete="off">
            </div>
            <p class="fine-print" style="text-align:center;margin:0 0 12px;font-size:0.82rem;">Tip: You can paste your full 6-digit code directly into the boxes.</p>

            <div id="modal-otp-error" class="form-error" style="text-align:center;margin-bottom:10px;"></div>
            <div id="modal-otp-success" style="display:none;margin-bottom:12px;padding:8px 12px;background:#eef8ed;border:2px solid #2e7d32;border-radius:6px;color:#1b5e20;font-size:0.9rem;text-align:center;font-weight:700;"></div>

            <button type="submit" class="pill primary full" id="modal-otp-submit-btn" style="font-size:1.05rem;padding:12px;">Complete Sign Up &rarr;</button>

            <div class="otp-resend-row" style="margin-top:16px;text-align:center;display:flex;justify-content:center;align-items:center;gap:6px;font-size:0.9rem;">
              <span style="color:var(--muted);">Didn't receive code?</span>
              <button type="button" id="modal-otp-resend-btn" class="otp-btn-link" disabled style="opacity:0.6;cursor:not-allowed;font-weight:700;">Resend code in 2:00</button>
            </div>
          </form>
        </div>
      </div>`;

    document.getElementById("modal-close").onclick = closeModal;
    document.getElementById("modal-backdrop").onclick = (e) => {
      if (e.target.id === "modal-backdrop") closeModal();
    };

    document.getElementById("modal-otp-change-email")?.addEventListener("click", () => {
      renderStandardAuth("signup", email, username);
    });

    const digitBoxes = Array.from(modalRoot.querySelectorAll(".otp-digit-box"));
    const form = document.getElementById("modal-otp-form");
    const submitBtn = document.getElementById("modal-otp-submit-btn");
    const resendBtn = document.getElementById("modal-otp-resend-btn");
    const errEl = document.getElementById("modal-otp-error");
    const succEl = document.getElementById("modal-otp-success");

    // 2-minute cooldown timer (120 seconds) as specifically requested
    let resendSeconds = 120;
    function formatTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec < 10 ? "0" : ""}${sec}`;
    }

    function updateResendState() {
      if (!resendBtn) return;
      if (resendSeconds > 0) {
        resendBtn.disabled = true;
        resendBtn.style.opacity = "0.6";
        resendBtn.style.cursor = "not-allowed";
        resendBtn.textContent = `Resend code in ${formatTime(resendSeconds)}`;
      } else {
        resendBtn.disabled = false;
        resendBtn.style.opacity = "1";
        resendBtn.style.cursor = "pointer";
        resendBtn.textContent = "Resend Code";
      }
    }

    updateResendState();
    currentResendTimer = setInterval(() => {
      resendSeconds--;
      updateResendState();
      if (resendSeconds <= 0) {
        clearInterval(currentResendTimer);
        currentResendTimer = null;
      }
    }, 1000);

    resendBtn.addEventListener("click", async () => {
      if (resendSeconds > 0) return;
      resendBtn.disabled = true;
      resendBtn.textContent = "Sending…";
      errEl.textContent = "";
      succEl.style.display = "none";

      const res = await MI_AUTH.resendVerificationOtp(email, "signup");
      if (!res.ok) {
        errEl.textContent = res.error || "Failed to resend code. Please try again.";
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend Code";
        return;
      }

      succEl.textContent = "A fresh 6-digit confirmation code has been sent!";
      succEl.style.display = "block";
      resendSeconds = 120; // 2 minutes cooldown
      updateResendState();
      if (currentResendTimer) clearInterval(currentResendTimer);
      currentResendTimer = setInterval(() => {
        resendSeconds--;
        updateResendState();
        if (resendSeconds <= 0) {
          clearInterval(currentResendTimer);
          currentResendTimer = null;
        }
      }, 1000);
    });

    function getEnteredToken() {
      return digitBoxes.map(b => b.value.trim()).join("");
    }

    // Input handlers for 6-digit boxes
    digitBoxes.forEach((box, idx) => {
      box.addEventListener("input", () => {
        const val = box.value.replace(/\D/g, "");
        box.value = val ? val[0] : "";
        errEl.textContent = "";
        if (val && idx < 5) {
          digitBoxes[idx + 1].focus();
          digitBoxes[idx + 1].select();
        }
        if (getEnteredToken().length === 6) {
          form.requestSubmit();
        }
      });

      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace") {
          if (!box.value && idx > 0) {
            digitBoxes[idx - 1].value = "";
            digitBoxes[idx - 1].focus();
          }
        } else if (e.key === "ArrowLeft" && idx > 0) {
          digitBoxes[idx - 1].focus();
          digitBoxes[idx - 1].select();
        } else if (e.key === "ArrowRight" && idx < 5) {
          digitBoxes[idx + 1].focus();
          digitBoxes[idx + 1].select();
        }
      });

      box.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text") || "";
        const digits = text.replace(/\D/g, "").slice(0, 6);
        if (!digits) return;
        for (let i = 0; i < 6; i++) {
          if (i < digits.length) digitBoxes[i].value = digits[i];
        }
        if (digits.length >= 6) {
          digitBoxes[5].focus();
          form.requestSubmit();
        } else {
          digitBoxes[digits.length]?.focus();
        }
      });

      box.addEventListener("focus", () => box.select());
    });

    setTimeout(() => digitBoxes[0]?.focus(), 150);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const token = getEnteredToken();
      errEl.textContent = "";

      if (token.length !== 6 || !/^\d{6}$/.test(token)) {
        errEl.textContent = "Please enter all 6 digits of your code.";
        const firstEmpty = digitBoxes.find(b => !b.value.trim());
        if (firstEmpty) firstEmpty.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying…";

      try {
        const result = await MI_AUTH.verifyOtp(email, token, "signup");
        submitBtn.disabled = false;
        submitBtn.textContent = "Complete Sign Up →";

        if (!result.ok) {
          errEl.textContent = result.error || "Invalid or expired code. Please try again.";
          digitBoxes.forEach(b => {
            b.classList.add("shake");
            setTimeout(() => b.classList.remove("shake"), 400);
          });
          return;
        }

        // Successful completion!
        if (currentResendTimer) {
          clearInterval(currentResendTimer);
          currentResendTimer = null;
        }
        const modalEl = modalRoot.querySelector(".modal");
        if (modalEl) {
          modalEl.innerHTML = `
            <div style="padding:24px 16px;text-align:center;">
              <div style="width:56px;height:56px;background:#2e7d32;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:12px;box-shadow:3px 3px 0 var(--ink);">✓</div>
              <h2 style="font-family:'Anton',sans-serif;font-size:1.8rem;margin:0 0 6px;color:var(--ink);">Sign Up Complete!</h2>
              <p style="color:var(--muted);font-size:1rem;margin:0;">Welcome to Marvel India!</p>
            </div>
          `;
        }
        updateAuthHeader();
        setTimeout(() => {
          closeModal();
          route();
        }, 1400);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Complete Sign Up →";
        errEl.textContent = "An error occurred: " + err.message;
      }
    };
  }

  if (defaultMode === "verify") {
    renderOtpStep(initialEmail, "");
  } else {
    renderStandardAuth(defaultMode, initialEmail);
  }
}
function closeModal(syncHistory = true) {
  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) modalRoot.innerHTML = "";
  if (syncHistory && history.state && history.state.miModal) {
    history.back();
  }
}

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

// ---------------------------------------------------------------- NAVIGATION HISTORY
// On-screen back button removed per user directive; user's device back button (hardware back / browser back / swipe back) handles navigation.
const _navHistory = [];
function recordNav(hash) {
  const clean = hash || "#/home";
  if (!_navHistory.length || _navHistory[_navHistory.length - 1] !== clean) {
    _navHistory.push(clean);
    if (_navHistory.length > 40) _navHistory.shift();
  }
}

window.marvelGoBack = function(fallbackHash = "#/home") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  location.hash = fallbackHash || "#/home";
};

function backButton() {
  return "";
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
        <p>If you have questions regarding this Privacy Policy or data requests, please reach out to our privacy officer at <a href="mailto:legal@marvelindia.in" class="link">legal@marvelindia.in</a> or for community inquiries write to <a href="mailto:contact@marvelindia.in" class="link">contact@marvelindia.in</a>.</p>
        
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

        <h2>5. Inquiries &amp; Notice</h2>
        <p>For questions, DMCA copyright notices, or legal compliance, contact us directly at <a href="mailto:legal@marvelindia.in" class="link">legal@marvelindia.in</a>. For editorial and community inquiries, contact <a href="mailto:contact@marvelindia.in" class="link">contact@marvelindia.in</a>.</p>

        <div style="margin-top:28px; display:flex; gap:12px; flex-wrap:wrap;">
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
  let doomRelease = doom.release_date;
  if (doom.title && doom.title.includes("Doomsday") && (!doomRelease || doomRelease === "2026-05-01")) {
    doomRelease = "2026-12-18";
  }

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
        <h2>Featured Releases</h2>
        <a href="#/search" class="link">Search all titles →</a>
      </div>
      <div class="grid">${enriched.map(posterCard).join("")}</div>
    </section>

    <!-- OFFICIAL TRAILERS & TEASERS -->
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Official Trailers &amp; Teasers</h2>
          <p class="muted" style="margin:2px 0 0;">Watch high-definition first looks, San Diego Comic-Con reveals, and official teasers.</p>
        </div>
        <a href="#/trailers" class="link">All Trailers &rarr;</a>
      </div>
      <div class="trailers-grid">
        ${(window.MI_TRAILERS || []).slice(0, 3).map(homeTrailerCard).join("")}
      </div>
    </section>

    <section class="section quicklinks">
      <a class="quick comic-panel" href="#/trailers"><h3>Trailers</h3><p>Official 4K teasers and Marvel Studios reveals.</p></a>
      <a class="quick comic-panel" href="#/timeline"><h3>MCU Timeline</h3><p>The story in chronological order, movie by movie.</p></a>
      <a class="quick comic-panel" href="#/roadmap"><h3>Watch Plan</h3><p>MCU release schedule and complete phase checklist.</p></a>
      <a class="quick comic-panel" href="#/blog"><h3>Blog</h3><p>Fan theories, reviews and news from the community.</p></a>
      <a class="quick comic-panel" href="#/shop"><h3>Shop</h3><p>Authentic Marvel figures, comics &amp; apparel.</p></a>
    </section>
  `;
  startCountdown(doomRelease);

  // Wire trailer cards click
  app.querySelectorAll(".trailer-card[data-yt]").forEach(card => {
    card.addEventListener("click", () => {
      openVideoModal(card.dataset.yt, card.dataset.title, card.dataset.movie);
    });
  });
}

function homeTrailerCard(t) {
  return `
    <div class="trailer-card comic-panel" data-yt="${esc(t.youtubeId)}" data-title="${esc(t.title)}" data-movie="${esc(t.movieTitle)}" style="cursor:pointer;">
      <div class="trailer-thumb-wrap">
        <img src="https://img.youtube.com/vi/${esc(t.youtubeId)}/hqdefault.jpg" alt="${esc(t.title)}" loading="lazy">
        <div class="play-btn-overlay">
          <div class="play-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        </div>
        <span class="trailer-badge">${esc(t.categoryLabel || t.phase || "Official Footage")}</span>
        ${t.duration ? `<span class="trailer-duration">${esc(t.duration)}</span>` : ""}
      </div>
      <div class="trailer-body">
        <span class="trailer-meta">${esc(t.movieTitle)} &bull; ${esc(t.quality || "4K UHD")}</span>
        <h3 class="trailer-title">${esc(t.title)}</h3>
        <p class="trailer-blurb">${esc(t.blurb)}</p>
        <div class="trailer-actions">
          <button type="button" class="pill primary mini-pill watch-now-btn" style="width:100%;">▶ Watch Trailer</button>
        </div>
      </div>
    </div>
  `;
}

function getBlogExcerpt(body, maxLen = 150) {
  if (!body) return "";
  if (typeof body === "string" && (body.trim().startsWith("{") || body.includes('"blocks"'))) {
    try {
      const parsed = JSON.parse(body);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        const firstPara = parsed.blocks.find(b => b.type === "paragraph" && b.text);
        if (firstPara) {
          const text = firstPara.text.replace(/\s+/g, " ").trim();
          return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
        }
      }
    } catch (_) {}
  }
  const clean = String(body).replace(/\s+/g, " ").trim();
  return clean.slice(0, maxLen) + (clean.length > maxLen ? "…" : "");
}

function homeBlogFeedCard(p) {
  const author = esc(p.profiles ? p.profiles.username : "Contributor");
  const date = fmtDate(p.created_at);
  const excerpt = esc(getBlogExcerpt(p.body, 160));
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
  let cleanDate = targetDateStr;
  if (!cleanDate || cleanDate === "2026-05-01") {
    cleanDate = "2026-12-18";
  }
  const target = new Date(cleanDate).getTime();
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
    <section class="section search-section">
      <div class="search-hero comic-panel">
        <div class="search-hero-head">
          <h1>Search Movies &amp; Series</h1>
          <p class="search-sub">Explore Marvel films, Disney+ series, and upcoming releases.</p>
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

  // Collect movie trailers from TMDB and curated list
  const movieVideos = [];
  if (tmdbFull && tmdbFull.videos && tmdbFull.videos.results) {
    tmdbFull.videos.results
      .filter(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
      .forEach(v => {
        movieVideos.push({
          title: v.name,
          youtubeId: v.key,
          duration: "HD",
          categoryLabel: v.type
        });
      });
  }
  const normKey = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const currentNorm = normKey(title);
  (window.MI_TRAILERS || []).forEach(t => {
    const tMovieNorm = normKey(t.movieTitle);
    const tTitleNorm = normKey(t.title);
    if (tMovieNorm === currentNorm || currentNorm.includes(tMovieNorm) || tTitleNorm.includes(currentNorm)) {
      if (!movieVideos.some(mv => mv.youtubeId === t.youtubeId)) {
        movieVideos.unshift({
          title: t.title,
          youtubeId: t.youtubeId,
          duration: t.duration || "4K UHD",
          categoryLabel: t.categoryLabel || "Official Trailer"
        });
      }
    }
  });

  app.innerHTML = `
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

    ${movieVideos.length ? `
    <section class="section">
      <div class="section-head">
        <h2>Official Trailers &amp; Footage</h2>
        <span class="muted">${movieVideos.length} Video${movieVideos.length > 1 ? "s" : ""} Available</span>
      </div>
      <div class="trailers-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        ${movieVideos.slice(0, 4).map(v => `
          <div class="trailer-card comic-panel" data-yt="${esc(v.youtubeId)}" data-title="${esc(v.title)}" data-movie="${esc(title)}" style="cursor:pointer;">
            <div class="trailer-thumb-wrap">
              <img src="https://img.youtube.com/vi/${esc(v.youtubeId)}/hqdefault.jpg" alt="${esc(v.title)}" loading="lazy">
              <div class="play-btn-overlay">
                <div class="play-circle">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
              </div>
              <span class="trailer-badge">${esc(v.categoryLabel)}</span>
              ${v.duration ? `<span class="trailer-duration">${esc(v.duration)}</span>` : ""}
            </div>
            <div class="trailer-body">
              <h3 class="trailer-title" style="font-size:1.1rem;margin-bottom:8px;">${esc(v.title)}</h3>
              <div class="trailer-actions">
                <button type="button" class="watch-now-btn" style="flex:1;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Watch Video
                </button>
                <a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.youtubeId)}" target="_blank" rel="noopener" class="ext-yt-btn" title="Open directly on YouTube" onclick="event.stopPropagation();">
                  YouTube ↗
                </a>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </section>` : ""}

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

  // Wire movie trailer cards click
  app.querySelectorAll(".trailer-card[data-yt]").forEach(card => {
    card.addEventListener("click", () => {
      openVideoModal(card.dataset.yt, card.dataset.title, card.dataset.movie);
    });
  });
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
  let items = [];
  try {
    items = await MI_DB.getTimeline();
  } catch (err) {
    console.warn("[MarvelIndia] Timeline fetch failed, using local:", err);
  }
  if (!items || !items.length) {
    items = (MI_DB.localTimeline && MI_DB.localTimeline()) || [];
  }

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

// ---------------------------------------------------------------- ROADMAP (+ Doomsday watch plan synced with DB)
async function renderRoadmap() {
  app.innerHTML = `<div class="loading">Building your roadmap…</div>`;
  const userId = currentUserId();
  let roadmap = [];
  let watchedIds = [];
  let doom = null;
  try {
    const results = await Promise.all([
      MI_DB.getRoadmap().catch(() => (MI_DB.localRoadmap && MI_DB.localRoadmap()) || []),
      MI_DB.getWatchedIds(userId).catch(() => []),
      MI_DB.getSpotlightMovie().catch(() => null)
    ]);
    roadmap = results[0];
    watchedIds = results[1];
    doom = results[2];
  } catch (err) {
    console.warn("[MarvelIndia] Roadmap load error, falling back to local:", err);
  }
  if (!roadmap || !roadmap.length) {
    roadmap = (MI_DB.localRoadmap && MI_DB.localRoadmap()) || [];
  }
  const watchedSet = new Set(watchedIds || []);

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
  let doomsdayDateStr = doom ? doom.release_date : "2026-12-18";
  if (!doomsdayDateStr || doomsdayDateStr === "2026-05-01") {
    doomsdayDateStr = "2026-12-18";
  }
  const doomsdayDate = new Date(doomsdayDateStr);
  const now = new Date();
  const daysLeft = Math.max(1, Math.ceil((doomsdayDate - now) / 86400000));
  const unwatched = roadmap.filter(m => m.status === "released" && !watchedSet.has(m.id));
  const mustWatchUnwatched = unwatched.filter(m => m.priority === "must-watch");
  const remainingMinutesAll = unwatched.reduce((s, m) => s + m.runtime_minutes, 0);
  const remainingMinutesMustWatch = mustWatchUnwatched.reduce((s, m) => s + m.runtime_minutes, 0);
  const minutesPerDayMust = daysLeft ? Math.ceil(remainingMinutesMustWatch / daysLeft) : 0;

  app.innerHTML = `
    <section class="section">
      <h1>Marvel Roadmap &amp; Checklist</h1>
      <p class="muted">Every MCU film, Disney+ series, and Marvel project in chronological release order. Track your progress as you watch.</p>

      <div class="watch-plan comic-panel">
        <h2>Doomsday Watch Plan</h2>
        <div class="watch-plan-stats">
          <div><strong>${daysLeft}</strong><span>days until ${esc((doom && doom.title) || "Avengers: Doomsday")} (${fmtDate(doomsdayDateStr)})</span></div>
          <div><strong>${unwatched.length}</strong><span>unwatched titles</span></div>
          <div><strong>${fmtMinutes(remainingMinutesAll)}</strong><span>total remaining runtime</span></div>
          <div><strong>${fmtMinutes(remainingMinutesMustWatch)}</strong><span>must-watch remaining</span></div>
          <div><strong>~${fmtMinutes(minutesPerDayMust)}</strong><span>per day to finish must-watch in time</span></div>
        </div>
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
                  ${m.status === "upcoming" ? `<span class="tag upcoming-tag">${m.release_date ? fmtDate(m.release_date) : "Upcoming"}</span>` : ""}
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
    <section class="section">
      <h1>${esc(currentUsername())}'s wishlist</h1>
      ${list.length ? `<div class="grid">${list.map(i => posterCard({ id: i.item_id, title: i.title, year: "", poster: i.poster_url })).join("")}</div>`
        : `<p class="muted">Nothing saved yet — open any title and tap "Add to wishlist".</p>`}
    </section>`;
}

// ---------------------------------------------------------------- BLOG
async function renderBlogList() {
  app.innerHTML = `<div class="loading">Loading posts…</div>`;
  let posts = [];
  try {
    posts = await MI_DB.getBlogPosts();
  } catch (err) {
    console.warn("[MarvelIndia] Blog list load error, using local:", err);
  }
  if (!posts || !posts.length) {
    posts = (MI_DB.localBlogPosts && MI_DB.localBlogPosts()) || [];
  }
  const userId = currentUserId();
  app.innerHTML = `
    <section class="section">
      <div class="section-head">
        <h1>Blog</h1>
        ${userId ? `<a href="#/blog/new" class="pill primary">Write a post</a>` : `<button class="pill" id="blog-login-btn">Log in to write</button>`}
      </div>
      ${posts.length ? `<div class="blog-grid">${posts.map(blogCard).join("")}</div>` : `<p class="muted">No posts yet — be the first to write one.</p>`}
    </section>
  `;
  if (!userId) {
    const btn = document.getElementById("blog-login-btn");
    if (btn) btn.onclick = openAuthModal;
  }
}
function blogCard(p) {
  const excerpt = getBlogExcerpt(p.body, 140);
  return `
    <a class="blog-card comic-panel" href="#/blog/${p.slug}">
      ${p.cover_image_url ? `<div class="blog-cover" style="background-image:url('${p.cover_image_url}')"></div>` : ""}
      <div class="blog-card-body">
        <h3>${esc(p.title)}</h3>
        <p class="muted">by ${esc(p.profiles ? p.profiles.username : "someone")} · ${fmtDate(p.created_at)}</p>
        <p>${esc(excerpt)}</p>
        ${(p.tags || []).length ? `<div class="tag-row">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
      </div>
    </a>`;
}

function formatArticleText(rawText) {
  if (!rawText) return "";
  let safe = esc(rawText);
  // Support bold: **text**
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Support italics: *text*
  safe = safe.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1<em>$2</em>$3");
  // Next-line feature: normalize carriage returns, then preserve single newlines with <br>
  safe = safe.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  safe = safe.replace(/\n/g, "<br>");
  return safe;
}

function renderArticleBody(rawBody) {
  if (!rawBody) return `<p class="article-paragraph muted">No story content available.</p>`;

  // 1. Check for sequential multi-block article payload
  if (typeof rawBody === "string" && (rawBody.trim().startsWith("{") && rawBody.includes('"blocks"'))) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed.blocks && Array.isArray(parsed.blocks) && parsed.blocks.length) {
        return parsed.blocks.map((block, idx) => {
          if (block.type === "paragraph") {
            const formatted = formatArticleText(block.text);
            if (!formatted) return "";
            return `<p class="article-paragraph" data-block="${idx}">${formatted}</p>`;
          } else if (block.type === "image") {
            const src = block.url ? String(block.url).replace("http://", "https://") : "";
            if (!src) return "";
            return `
              <figure class="article-image-figure" data-block="${idx}">
                <img src="${esc(src)}" alt="${esc(block.caption || 'Article photo')}" loading="lazy">
                ${block.caption ? `
                  <figcaption class="article-image-caption">
                    <span>[PHOTO]</span> ${esc(block.caption)}
                  </figcaption>` : ""}
              </figure>
            `;
          }
          return "";
        }).join("");
      }
    } catch (e) {
      console.warn("[MarvelIndia] Multi-block JSON parse fallback:", e);
    }
  }

  // 2. Standard single or multi-line article format with next-line support
  const paragraphs = String(rawBody).split(/\n\s*\n/);
  return paragraphs.map((p, idx) => {
    const trimmed = p.trim();
    if (!trimmed) return "";
    return `<p class="article-paragraph" data-block="${idx}">${formatArticleText(trimmed)}</p>`;
  }).join("");
}

async function renderBlogPost(slug) {
  app.innerHTML = `<div class="loading">Loading post…</div>`;
  let post = null;
  try {
    post = await MI_DB.getBlogPost(slug);
  } catch (err) {
    console.warn("[MarvelIndia] BlogPost load error, using local:", err);
  }
  if (!post && MI_DB.localBlogPosts) {
    post = MI_DB.localBlogPosts().find(p => p.slug === slug) || null;
  }
  if (!post) { app.innerHTML = `<section class="section"><h1>Post not found</h1><a href="#/blog" class="link">← Back to Blog</a></section>`; return; }
  const userId = currentUserId();
  let comments = [];
  try {
    comments = await MI_DB.getBlogComments(post.id);
  } catch (err) {
    comments = [];
  }
  let suggestionsHtml = "";
  try {
    suggestionsHtml = await renderDetailSuggestions(null, slug);
  } catch (err) {
    suggestionsHtml = "";
  }

  const renderedContent = renderArticleBody(post.body);

  app.innerHTML = `
    <section class="section blog-post-view">
      <div class="comic-panel" style="padding: 24px 28px; background: #ffffff; margin-bottom: 24px;">
        ${post.cover_image_url ? `<div class="blog-detail-cover" style="background-image:url('${post.cover_image_url}')"></div>` : ""}
        <div class="blog-post-header">
          <h1>${esc(post.title)}</h1>
          <div class="blog-author-bar">
            <span>By <strong>${esc(post.profiles ? post.profiles.username : "Marvelite Writer")}</strong></span>
            <span>&bull;</span>
            <span>${fmtDate(post.created_at)}</span>
            <span>&bull;</span>
            <span>Indian Marvel Community</span>
          </div>
          ${(post.tags || []).length ? `<div class="tag-row">${post.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>

        <div class="blog-article-content">
          ${renderedContent}
        </div>
      </div>

      <div class="comic-panel" style="padding: 24px; background: #ffffff;">
        <h2 style="margin-top:0;">Marvelite Discussion &amp; Comments</h2>
        <div id="comments-list">${renderComments(comments.map(c => ({ ...c, body: c.body })))}</div>
        <form id="comment-form" class="comment-form" style="margin-top:16px;">
          <textarea name="text" placeholder="${userId ? "Join the discussion… Enter your theory or thoughts" : "Sign up or log in to comment"}" ${userId ? "" : "disabled"}></textarea>
          <button class="pill primary" type="submit" ${userId ? "" : "disabled"}>Post Comment</button>
        </form>
        <p class="form-error" id="comment-error"></p>
      </div>
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

  // Sequential builder state: start with one paragraph
  let blockCounter = 1;
  let articleBlocks = [
    { id: 1, type: "paragraph", text: "" }
  ];
  let showLivePreview = false;
  let coverPreviewUrl = "";

  function renderBuilder() {
    app.innerHTML = `
      <section class="section blog-builder-wrap">
        <div class="section-head" style="margin-bottom:16px;">
          <div>
            <h1>Craft Community Dispatch</h1>
            <p class="muted">Compose rich Marvel theories, reviews, and breakdowns with sequential paragraphs and in-article photos.</p>
          </div>
          <a href="#/blog" class="link">&larr; Back to Blog</a>
        </div>

        <form id="new-post-form" class="blog-builder-form">
          <!-- Main Info Panel -->
          <div class="comic-panel blog-builder-hero-panel">
            <h2 style="margin-top:0; font-size:1.4rem;">1. Story Essentials</h2>
            <div style="display:flex; flex-direction:column; gap:14px;">
              <label style="display:flex; flex-direction:column; gap:4px; font-family:'Barlow Condensed',sans-serif; font-weight:700;">
                Article Headline / Title *
                <input name="title" id="builder-title" required placeholder="e.g. Battleworld Layout Deciphered: Secret Wars Breakdown" style="font-family:'Anton',sans-serif; font-size:1.3rem; padding:10px 14px; border:2px solid var(--ink);">
              </label>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px;">
                <label style="display:flex; flex-direction:column; gap:4px; font-family:'Barlow Condensed',sans-serif; font-weight:700;">
                  Topic Tags (comma separated)
                  <input name="tags" id="builder-tags" placeholder="theory, secret-wars, phase-6" style="padding:8px 12px; border:2px solid var(--ink);">
                </label>
                <label style="display:flex; flex-direction:column; gap:4px; font-family:'Barlow Condensed',sans-serif; font-weight:700;">
                  Cover Image URL (optional)
                  <input name="cover_url" id="builder-cover-url" type="url" placeholder="https://images.unsplash.com/..." style="padding:8px 12px; border:2px solid var(--ink);">
                </label>
              </div>
              <label style="display:flex; flex-direction:column; gap:4px; font-family:'Barlow Condensed',sans-serif; font-weight:700;">
                Or Upload Cover Banner File
                <input name="cover_file" id="builder-cover-file" type="file" accept="image/*" style="font-size:0.95rem;">
              </label>
            </div>
          </div>

          <!-- Sequential Story Flow Section -->
          <div class="comic-panel" style="background:#ffffff; padding:24px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:2px solid var(--ink); padding-bottom:12px;">
              <div>
                <h2 style="margin:0; font-size:1.4rem;">2. Story Content Flow</h2>
                <span class="muted" style="font-size:0.92rem;">Add paragraphs and images sequentially one by one in your desired reading order.</span>
              </div>
              <button type="button" class="pill ghost mini-pill" id="toggle-preview-btn">
                ${showLivePreview ? "Hide Live Preview" : "Show Live Preview"}
              </button>
            </div>

            <!-- List of Sequential Blocks -->
            <div class="builder-blocks-list" id="builder-blocks-container">
              ${renderBlocksListHtml()}
            </div>

            <!-- Toolbar to Add Next Block One by One -->
            <div class="builder-actions-toolbar">
              <span style="font-family:'Barlow Condensed',sans-serif; font-weight:700; text-transform:uppercase; font-size:0.95rem; color:var(--ink);">+ Insert Next Element:</span>
              <button type="button" class="builder-add-btn" id="add-para-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Paragraph Block
              </button>
              <button type="button" class="builder-add-btn" id="add-img-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Add Image Block
              </button>
            </div>

            <!-- Optional Real-time Story Preview -->
            <div id="live-preview-section" style="display:${showLivePreview ? "block" : "none"};">
              <div class="live-preview-box">
                <span class="tag" style="background:var(--ink); color:#fff; margin-bottom:12px; display:inline-block;">REAL-TIME ARTICLE PREVIEW</span>
                <div class="blog-article-content" id="preview-render-target">
                  ${getLivePreviewHtml()}
                </div>
              </div>
            </div>
          </div>

          <!-- Submission & Error Feedback -->
          <div class="comic-panel" style="background:#ffffff; padding:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <p class="form-error" id="post-error" style="margin:0; font-weight:700;"></p>
            <div style="display:flex; gap:12px;">
              <a href="#/blog" class="pill">Cancel</a>
              <button class="pill primary" id="publish-submit-btn" type="submit" style="font-size:1.1rem; padding:10px 24px;">Publish Dispatch &rarr;</button>
            </div>
          </div>
        </form>
      </section>
    `;

    bindBuilderEvents();
  }

  function renderBlocksListHtml() {
    return articleBlocks.map((block, index) => {
      const isFirst = index === 0;
      const isLast = index === articleBlocks.length - 1;
      const num = index + 1;

      if (block.type === "paragraph") {
        return `
          <div class="blog-builder-block comic-panel block-type-paragraph" data-block-id="${block.id}">
            <div class="block-header-row">
              <span class="block-badge">
                <span style="color:var(--marvel-red);">#${num}</span> PARAGRAPH
              </span>
              <div class="block-controls">
                <button type="button" class="block-ctrl-btn move-up-btn" data-id="${block.id}" ${isFirst ? "disabled" : ""} title="Move up">▲ Up</button>
                <button type="button" class="block-ctrl-btn move-down-btn" data-id="${block.id}" ${isLast ? "disabled" : ""} title="Move down">▼ Down</button>
                <button type="button" class="block-ctrl-btn btn-delete remove-btn" data-id="${block.id}" title="Remove paragraph" ${articleBlocks.length <= 1 ? "disabled" : ""}>✕ Remove</button>
              </div>
            </div>
            <textarea class="para-block-textarea" data-id="${block.id}" placeholder="Type paragraph content here... Press Enter for a clean next line. Single return creates a line break (<br>), double return creates spacing. Supports **bold** and *italic*.">${esc(block.text || "")}</textarea>
            <div class="para-format-hint">
              <span>Next-line formatting active: Enter creates line breaks</span>
              <span class="char-counter" id="counter-${block.id}">${(block.text || "").length} characters</span>
            </div>
          </div>
        `;
      } else if (block.type === "image") {
        return `
          <div class="blog-builder-block comic-panel block-type-image" data-block-id="${block.id}">
            <div class="block-header-row">
              <span class="block-badge" style="background:#fff3d1;">
                <span style="color:#b8860b;">#${num}</span> IN-STORY PHOTO
              </span>
              <div class="block-controls">
                <button type="button" class="block-ctrl-btn move-up-btn" data-id="${block.id}" ${isFirst ? "disabled" : ""} title="Move up">▲ Up</button>
                <button type="button" class="block-ctrl-btn move-down-btn" data-id="${block.id}" ${isLast ? "disabled" : ""} title="Move down">▼ Down</button>
                <button type="button" class="block-ctrl-btn btn-delete remove-btn" data-id="${block.id}" title="Remove image">✕ Remove</button>
              </div>
            </div>
            <div class="image-block-body">
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
                <label style="font-family:'Barlow Condensed',sans-serif; font-size:0.92rem; font-weight:700;">
                  Upload Photo File:
                  <input type="file" class="img-block-file-input" data-id="${block.id}" accept="image/*" style="margin-top:4px; font-size:0.9rem;">
                </label>
                <label style="font-family:'Barlow Condensed',sans-serif; font-size:0.92rem; font-weight:700;">
                  Or Enter Image URL:
                  <input type="url" class="img-block-url-input" data-id="${block.id}" value="${esc(block.url || "")}" placeholder="https://..." style="margin-top:4px; width:100%; padding:6px 10px; border:2px solid var(--ink);">
                </label>
              </div>

              ${block.url ? `
                <div class="image-preview-panel">
                  <img src="${esc(block.url)}" alt="Preview" onerror="this.src='assets/placeholder-poster.svg'">
                </div>` : `
                <div class="image-preview-panel" style="padding:20px; color:var(--muted); font-family:'Barlow Condensed',sans-serif; font-size:0.95rem;">
                  No photo selected yet. Upload an image file or paste a web URL above.
                </div>
              `}

              <label style="font-family:'Barlow Condensed',sans-serif; font-size:0.92rem; font-weight:700;">
                Caption / Attribution (optional):
                <input type="text" class="image-caption-input" data-id="${block.id}" value="${esc(block.caption || "")}" placeholder="e.g. Doctor Doom in Secret Wars issue #1 (Marvel Comics)...">
              </label>
            </div>
          </div>
        `;
      }
      return "";
    }).join("");
  }

  function getLivePreviewHtml() {
    const validBlocks = articleBlocks.filter(b => (b.type === "paragraph" && b.text.trim()) || (b.type === "image" && b.url));
    if (!validBlocks.length) {
      return `<p class="muted" style="font-style:italic;">Your sequential article preview will appear here as you type paragraphs and add photos...</p>`;
    }
    return validBlocks.map(b => {
      if (b.type === "paragraph") {
        return `<p class="article-paragraph">${formatArticleText(b.text)}</p>`;
      } else if (b.type === "image") {
        return `
          <figure class="article-image-figure">
            <img src="${esc(b.url)}" alt="${esc(b.caption || 'Article photo')}">
            ${b.caption ? `<figcaption class="article-image-caption"><span>[PHOTO]</span> ${esc(b.caption)}</figcaption>` : ""}
          </figure>
        `;
      }
      return "";
    }).join("");
  }

  function syncFormData() {
    // Preserve current values of title and tags
    const titleEl = document.getElementById("builder-title");
    const tagsEl = document.getElementById("builder-tags");
    const coverUrlEl = document.getElementById("builder-cover-url");
    return {
      title: titleEl ? titleEl.value : "",
      tags: tagsEl ? tagsEl.value : "",
      coverUrl: coverUrlEl ? coverUrlEl.value : ""
    };
  }

  function restoreFormData(saved) {
    const titleEl = document.getElementById("builder-title");
    const tagsEl = document.getElementById("builder-tags");
    const coverUrlEl = document.getElementById("builder-cover-url");
    if (titleEl && saved.title) titleEl.value = saved.title;
    if (tagsEl && saved.tags) tagsEl.value = saved.tags;
    if (coverUrlEl && saved.coverUrl) coverUrlEl.value = saved.coverUrl;
  }

  function refreshBlocksUI() {
    const saved = syncFormData();
    const container = document.getElementById("builder-blocks-container");
    if (container) {
      container.innerHTML = renderBlocksListHtml();
      bindBlockEvents();
    }
    const previewEl = document.getElementById("preview-render-target");
    if (previewEl) {
      previewEl.innerHTML = getLivePreviewHtml();
    }
    restoreFormData(saved);
  }

  function bindBlockEvents() {
    // Textarea inputs
    document.querySelectorAll(".para-block-textarea").forEach(textarea => {
      textarea.addEventListener("input", (e) => {
        const id = Number(e.target.dataset.id);
        const block = articleBlocks.find(b => b.id === id);
        if (block) {
          block.text = e.target.value;
          const counter = document.getElementById(`counter-${id}`);
          if (counter) counter.textContent = `${block.text.length} characters`;
          if (showLivePreview) {
            const previewEl = document.getElementById("preview-render-target");
            if (previewEl) previewEl.innerHTML = getLivePreviewHtml();
          }
        }
      });
    });

    // Image URL inputs
    document.querySelectorAll(".img-block-url-input").forEach(inp => {
      inp.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.id);
        const block = articleBlocks.find(b => b.id === id);
        if (block) {
          block.url = e.target.value.trim();
          refreshBlocksUI();
        }
      });
    });

    // Image File inputs
    document.querySelectorAll(".img-block-file-input").forEach(fileInp => {
      fileInp.addEventListener("change", (e) => {
        const id = Number(e.target.dataset.id);
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const block = articleBlocks.find(b => b.id === id);
            if (block) {
              block.url = re.target.result; // Data URL for instant rendering
              block.file = file;
              refreshBlocksUI();
            }
          };
          reader.readAsDataURL(file);
        }
      });
    });

    // Image Caption inputs
    document.querySelectorAll(".image-caption-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const id = Number(e.target.dataset.id);
        const block = articleBlocks.find(b => b.id === id);
        if (block) {
          block.caption = e.target.value;
          if (showLivePreview) {
            const previewEl = document.getElementById("preview-render-target");
            if (previewEl) previewEl.innerHTML = getLivePreviewHtml();
          }
        }
      });
    });

    // Move Up
    document.querySelectorAll(".move-up-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const idx = articleBlocks.findIndex(b => b.id === id);
        if (idx > 0) {
          const temp = articleBlocks[idx];
          articleBlocks[idx] = articleBlocks[idx - 1];
          articleBlocks[idx - 1] = temp;
          refreshBlocksUI();
        }
      });
    });

    // Move Down
    document.querySelectorAll(".move-down-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const idx = articleBlocks.findIndex(b => b.id === id);
        if (idx >= 0 && idx < articleBlocks.length - 1) {
          const temp = articleBlocks[idx];
          articleBlocks[idx] = articleBlocks[idx + 1];
          articleBlocks[idx + 1] = temp;
          refreshBlocksUI();
        }
      });
    });

    // Remove Block
    document.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        if (articleBlocks.length <= 1) return;
        articleBlocks = articleBlocks.filter(b => b.id !== id);
        refreshBlocksUI();
      });
    });
  }

  function bindBuilderEvents() {
    bindBlockEvents();

    // Toggle live preview
    document.getElementById("toggle-preview-btn")?.addEventListener("click", () => {
      showLivePreview = !showLivePreview;
      const prevSection = document.getElementById("live-preview-section");
      if (prevSection) prevSection.style.display = showLivePreview ? "block" : "none";
      const toggleBtn = document.getElementById("toggle-preview-btn");
      if (toggleBtn) toggleBtn.textContent = showLivePreview ? "Hide Live Preview" : "Show Live Preview";
      if (showLivePreview) {
        const previewEl = document.getElementById("preview-render-target");
        if (previewEl) previewEl.innerHTML = getLivePreviewHtml();
      }
    });

    // Add Paragraph Block button
    document.getElementById("add-para-btn")?.addEventListener("click", () => {
      blockCounter++;
      articleBlocks.push({ id: blockCounter, type: "paragraph", text: "" });
      refreshBlocksUI();
      // Scroll to the newly added block
      setTimeout(() => {
        const newBlockEl = document.querySelector(`.blog-builder-block[data-block-id="${blockCounter}"] textarea`);
        if (newBlockEl) newBlockEl.focus();
      }, 100);
    });

    // Add Image Block button
    document.getElementById("add-img-btn")?.addEventListener("click", () => {
      blockCounter++;
      articleBlocks.push({ id: blockCounter, type: "image", url: "", caption: "", file: null });
      refreshBlocksUI();
      setTimeout(() => {
        const newBlockEl = document.querySelector(`.blog-builder-block[data-block-id="${blockCounter}"]`);
        if (newBlockEl) newBlockEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    });

    // Form submission
    const form = document.getElementById("new-post-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("post-error");
        const submitBtn = document.getElementById("publish-submit-btn");
        errEl.textContent = "";

        const title = (document.getElementById("builder-title")?.value || "").trim();
        const tags = (document.getElementById("builder-tags")?.value || "").trim();
        const coverUrlInput = (document.getElementById("builder-cover-url")?.value || "").trim();
        const coverFileInput = document.getElementById("builder-cover-file");
        const coverFile = coverFileInput && coverFileInput.files && coverFileInput.files[0] ? coverFileInput.files[0] : null;

        if (!title) {
          errEl.textContent = "Please provide an article title.";
          return;
        }

        // Validate that at least one paragraph has content
        const hasText = articleBlocks.some(b => b.type === "paragraph" && b.text.trim().length > 0);
        if (!hasText) {
          errEl.textContent = "Please add at least one paragraph of text to your article.";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Publishing Dispatch…";

        // Package blocks cleanly
        const cleanBlocks = articleBlocks
          .filter(b => (b.type === "paragraph" && b.text.trim()) || (b.type === "image" && b.url))
          .map(b => {
            if (b.type === "paragraph") {
              return { type: "paragraph", text: b.text.trim() };
            } else {
              return { type: "image", url: b.url, caption: (b.caption || "").trim() };
            }
          });

        const bodyJson = JSON.stringify({
          version: 2,
          blocks: cleanBlocks
        });

        const result = await MI_DB.createBlogPost(userId, {
          title,
          body: bodyJson,
          tags,
          coverFile,
          coverUrl: coverUrlInput || null
        });

        if (!result.ok) {
          errEl.textContent = result.error || "Failed to publish article. Please try again.";
          submitBtn.disabled = false;
          submitBtn.textContent = "Publish Dispatch →";
          return;
        }

        location.hash = `#/blog/${result.slug}`;
      };
    }
  }

  renderBuilder();
}

// ---------------------------------------------------------------- VIDEO MODAL
let currentModalEscHandler = null;

function openVideoModal(youtubeId, title, movieTitle) {
  closeVideoModal();
  const backdrop = document.createElement("div");
  backdrop.id = "video-player-modal-backdrop";
  backdrop.className = "video-modal-backdrop";
  backdrop.innerHTML = `
    <div class="video-modal comic-panel">
      <div class="video-modal-header">
        <div>
          <h3 class="video-modal-title">${esc(title || "Official Trailer")}</h3>
          ${movieTitle ? `<span class="video-modal-sub">${esc(movieTitle)} &bull; Official Marvel Studios Footage</span>` : ""}
        </div>
        <button class="video-modal-close-btn" id="video-modal-close-btn" aria-label="Close video player">&times;</button>
      </div>
      <div class="video-responsive-wrap">
        <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0&modestbranding=1" 
          title="${esc(title || "Marvel Trailer")}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
      <div class="video-modal-footer">
        <span class="muted" style="font-size:0.85rem;">Streaming official Marvel Studios HD footage</span>
        <a href="https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}" target="_blank" rel="noopener" class="ext-yt-btn" style="padding:5px 12px;font-size:0.88rem;">Watch on YouTube ↗</a>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeVideoModal();
  });
  document.getElementById("video-modal-close-btn")?.addEventListener("click", closeVideoModal);

  currentModalEscHandler = (e) => {
    if (e.key === "Escape") closeVideoModal();
  };
  window.addEventListener("keydown", currentModalEscHandler);
}

function closeVideoModal() {
  if (currentModalEscHandler) {
    window.removeEventListener("keydown", currentModalEscHandler);
    currentModalEscHandler = null;
  }
  const existing = document.getElementById("video-player-modal-backdrop");
  if (existing) existing.remove();
  document.body.style.overflow = "";
}

// ---------------------------------------------------------------- TRAILERS PORTAL
function renderTrailers(initialCat) {
  const allTrailers = window.MI_TRAILERS || [];
  let activeCat = initialCat || "all";
  let searchQuery = "";

  const multiverseCount = allTrailers.filter(t => t.category === "multiverse").length;
  const infinityCount = allTrailers.filter(t => t.category === "infinity-saga").length;
  const seriesCount = allTrailers.filter(t => t.category === "series").length;

  function getFilteredTrailers() {
    let list = [...allTrailers];
    if (activeCat !== "all") {
      list = list.filter(t => t.category === activeCat);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t => 
        (t.title || "").toLowerCase().includes(q) ||
        (t.movieTitle || "").toLowerCase().includes(q) ||
        (t.blurb || "").toLowerCase().includes(q) ||
        (t.phase || "").toLowerCase().includes(q)
      );
    }
    return list;
  }

  function getListHtml() {
    const items = getFilteredTrailers();
    if (!items.length) {
      return `
        <div class="comic-panel" style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; background: #ffffff;">
          <h3 style="margin-bottom:8px;">No trailers found matching "${esc(searchQuery)}"</h3>
          <p class="muted" style="margin-bottom:16px;">Try searching for "Endgame", "Thunderbolts", "Infinity War", "Spider-Man", or "Loki".</p>
          <button type="button" class="trailers-reset-btn" id="trailer-reset-btn">Reset Filters</button>
        </div>`;
    }
    return items.map(t => `
      <div class="trailer-card comic-panel" data-yt="${esc(t.youtubeId)}" data-title="${esc(t.title)}" data-movie="${esc(t.movieTitle)}" style="cursor:pointer;">
        <div class="trailer-thumb-wrap">
          <img src="https://img.youtube.com/vi/${esc(t.youtubeId)}/hqdefault.jpg" alt="${esc(t.title)}" loading="lazy">
          <div class="play-btn-overlay">
            <div class="play-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
          </div>
          <span class="trailer-badge">${esc(t.categoryLabel || t.phase || "Official Footage")}</span>
          ${t.duration ? `<span class="trailer-duration">${esc(t.duration)}</span>` : ""}
        </div>
        <div class="trailer-body">
          <span class="trailer-meta">${esc(t.movieTitle)} &bull; ${esc(t.quality || "4K UHD")} &bull; ${esc(t.channel || "Marvel Studios")}</span>
          <h3 class="trailer-title">${esc(t.title)}</h3>
          <p class="trailer-blurb">${esc(t.blurb)}</p>
          <div class="trailer-actions">
            <button type="button" class="watch-now-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Watch Trailer
            </button>
            <a href="https://www.youtube.com/watch?v=${encodeURIComponent(t.youtubeId)}" target="_blank" rel="noopener" class="ext-yt-btn" title="Open directly on YouTube" onclick="event.stopPropagation();">
              YouTube ↗
            </a>
          </div>
        </div>
      </div>
    `).join("");
  }

  app.innerHTML = `
    <section class="section">
      <div class="trailers-header-card comic-panel">
        <h1>Official Marvel Trailers &amp; Teasers</h1>
        <p>Stream high-definition teasers, official Marvel Studios trailers, and Comic-Con footage with zero clutter.</p>
        
        <div class="trailers-search-box">
          <div class="trailers-search-inner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="trailers-live-search" placeholder="Filter trailers by movie, hero, or saga..." value="${esc(searchQuery)}">
            <button type="button" class="trailers-search-clear" id="trailers-search-clear" style="display:none;" aria-label="Clear search">&times;</button>
          </div>
        </div>

        <div class="trailers-filter-bar" id="trailers-filter-bar">
          <button type="button" class="trailers-filter-btn ${activeCat === "all" ? "active" : ""}" data-cat="all">All Trailers (${allTrailers.length})</button>
          <button type="button" class="trailers-filter-btn ${activeCat === "multiverse" ? "active" : ""}" data-cat="multiverse">Multiverse &amp; Phase 5 (${multiverseCount})</button>
          <button type="button" class="trailers-filter-btn ${activeCat === "infinity-saga" ? "active" : ""}" data-cat="infinity-saga">Infinity Saga Classics (${infinityCount})</button>
          <button type="button" class="trailers-filter-btn ${activeCat === "series" ? "active" : ""}" data-cat="series">Disney+ Series &amp; Animation (${seriesCount})</button>
        </div>
      </div>

      <div class="trailers-grid" id="trailers-container">
        ${getListHtml()}
      </div>
    </section>
  `;

  function refreshGrid() {
    const container = document.getElementById("trailers-container");
    if (container) {
      container.innerHTML = getListHtml();
      wireTrailerCards();
    }
  }

  function wireTrailerCards() {
    const container = document.getElementById("trailers-container");
    if (!container) return;
    container.querySelectorAll(".trailer-card[data-yt]").forEach(card => {
      card.addEventListener("click", () => {
        openVideoModal(card.dataset.yt, card.dataset.title, card.dataset.movie);
      });
    });
    document.getElementById("trailer-reset-btn")?.addEventListener("click", () => {
      activeCat = "all";
      searchQuery = "";
      const input = document.getElementById("trailers-live-search");
      if (input) input.value = "";
      const clearBtn = document.getElementById("trailers-search-clear");
      if (clearBtn) clearBtn.style.display = "none";
      document.querySelectorAll(".trailers-filter-bar .trailers-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === "all"));
      refreshGrid();
    });
  }

  // Filter bar buttons
  const filterBar = document.getElementById("trailers-filter-bar");
  filterBar?.querySelectorAll(".trailers-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCat = btn.dataset.cat;
      filterBar.querySelectorAll(".trailers-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      refreshGrid();
    });
  });

  // Live search input
  const searchInput = document.getElementById("trailers-live-search");
  const clearBtn = document.getElementById("trailers-search-clear");
  searchInput?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    if (clearBtn) clearBtn.style.display = searchQuery ? "block" : "none";
    refreshGrid();
  });
  clearBtn?.addEventListener("click", () => {
    searchQuery = "";
    if (searchInput) searchInput.value = "";
    clearBtn.style.display = "none";
    refreshGrid();
  });

  wireTrailerCards();
}

// ---------------------------------------------------------------- CONTACT & DISPATCH
function renderContact() {
  const cfg = window.MARVEL_INDIA_CONFIG || {};
  const contactEmail = cfg.CONTACT_EMAIL || "contact@marvelindia.in";
  const legalEmail = cfg.LEGAL_EMAIL || "legal@marvelindia.in";

  app.innerHTML = `
    <div class="contact-container section">
      <div class="contact-card comic-panel">
        <div class="contact-hero-banner">
          <h1>Official Communications</h1>
          <p>Official communication channels for the Marvel India community. Direct inquiries to the appropriate department below.</p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-bottom: 24px;">
          <div class="contact-highlight-box" style="margin-bottom:0; flex-direction:column; align-items:flex-start;">
            <div>
              <span class="muted" style="font-family:'Barlow Condensed',sans-serif;font-size:0.95rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;display:block;margin-bottom:4px;">Editorial &amp; Community Inquiries</span>
              <div class="contact-email-addr">${contactEmail}</div>
            </div>
            <div class="contact-email-actions" style="margin-top:10px; width:100%;">
              <button type="button" class="pill primary mini-pill" id="copy-contact-btn" data-email="${contactEmail}">Copy Email</button>
              <a href="mailto:${contactEmail}?subject=Marvel%20India%20Community%20Inquiry" class="pill ghost mini-pill">Send Mail ↗</a>
            </div>
          </div>

          <div class="contact-highlight-box" style="margin-bottom:0; flex-direction:column; align-items:flex-start;">
            <div>
              <span class="muted" style="font-family:'Barlow Condensed',sans-serif;font-size:0.95rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;display:block;margin-bottom:4px;">Legal, DMCA &amp; Compliance</span>
              <div class="contact-email-addr" style="color:var(--ink);">${legalEmail}</div>
            </div>
            <div class="contact-email-actions" style="margin-top:10px; width:100%;">
              <button type="button" class="pill primary mini-pill" id="copy-legal-btn" data-email="${legalEmail}">Copy Email</button>
              <a href="mailto:${legalEmail}?subject=Marvel%20India%20Legal%20Inquiry" class="pill ghost mini-pill">Send Mail ↗</a>
            </div>
          </div>
        </div>

        <h2 style="margin-bottom:14px;">Direct Mail Dispatch</h2>
        <form id="contact-inquiry-form" class="contact-form-grid">
          <div class="contact-form-row">
            <div class="contact-field">
              <label for="contact-name">Your Name</label>
              <input type="text" id="contact-name" name="name" required placeholder="e.g. Peter Parker">
            </div>
            <div class="contact-field">
              <label for="contact-recipient">Send To Department</label>
              <select id="contact-recipient" name="recipient">
                <option value="contact@marvelindia.in">General &amp; Community (contact@marvelindia.in)</option>
                <option value="legal@marvelindia.in">Legal &amp; Compliance (legal@marvelindia.in)</option>
              </select>
            </div>
          </div>

          <div class="contact-field">
            <label for="contact-category">Topic / Inquiry Type</label>
            <select id="contact-category" name="category">
              <option value="Community Dispatch / Fan Theory">Community Dispatch / Fan Theory</option>
              <option value="Merchandise Listing / Product Tip">Merchandise Listing / Product Tip</option>
              <option value="Roadmap / Watch Plan Feedback">Roadmap / Watch Plan Feedback</option>
              <option value="Bug Report / Site Performance">Bug Report / Site Performance</option>
              <option value="DMCA / Copyright / Fair Use Notice">DMCA / Copyright / Fair Use Notice</option>
              <option value="Official Partnership &amp; Press">Official Partnership &amp; Press</option>
            </select>
          </div>

          <div class="contact-field">
            <label for="contact-subject">Subject</label>
            <input type="text" id="contact-subject" name="subject" required placeholder="What is your message regarding?">
          </div>

          <div class="contact-field">
            <label for="contact-message">Message</label>
            <textarea id="contact-message" name="message" rows="5" required placeholder="Write your message here..."></textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:8px;">
            <button type="submit" class="pill primary">Send via Email Client ↗</button>
            <span class="muted" style="font-size:0.85rem;" id="contact-dest-hint">Pre-addresses to contact@marvelindia.in</span>
          </div>
          <p id="contact-status-msg" style="margin:8px 0 0; font-family:'Barlow Condensed',sans-serif; font-size:1.05rem; font-weight:700; color:#1b5e20; min-height:1.2em;"></p>
        </form>
      </div>
    </div>
  `;

  const setupCopyBtn = (btnId, email) => {
    document.getElementById(btnId)?.addEventListener("click", () => {
      navigator.clipboard.writeText(email).then(() => {
        const btn = document.getElementById(btnId);
        if (btn) {
          const old = btn.textContent;
          btn.textContent = "✓ Copied!";
          btn.classList.add("gold");
          setTimeout(() => {
            btn.textContent = old;
            btn.classList.remove("gold");
          }, 2000);
        }
      }).catch(() => {
        prompt("Copy email address:", email);
      });
    });
  };

  setupCopyBtn("copy-contact-btn", contactEmail);
  setupCopyBtn("copy-legal-btn", legalEmail);

  const recipientSelect = document.getElementById("contact-recipient");
  const destHint = document.getElementById("contact-dest-hint");
  recipientSelect?.addEventListener("change", () => {
    if (destHint) {
      destHint.textContent = `Pre-addresses to ${recipientSelect.value}`;
    }
  });

  document.getElementById("contact-inquiry-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const targetEmail = fd.get("recipient") || contactEmail;
    const name = fd.get("name") || "";
    const cat = fd.get("category") || "General";
    const sub = fd.get("subject") || "Marvel India Message";
    const msg = fd.get("message") || "";

    const mailSubject = encodeURIComponent(`[Marvel India: ${cat}] ${sub}`);
    const mailBody = encodeURIComponent(`Name: ${name}\nCategory: ${cat}\nDepartment: ${targetEmail}\n\nMessage:\n${msg}`);
    const mailtoUrl = `mailto:${targetEmail}?subject=${mailSubject}&body=${mailBody}`;

    const statusEl = document.getElementById("contact-status-msg");
    if (statusEl) {
      statusEl.textContent = `✓ Opening your email client addressed to ${targetEmail}...`;
    }
    window.location.href = mailtoUrl;
  });
}

// ---------------------------------------------------------------- SHOP (Amazon affiliate & Merchandise)
async function renderShop() {
  app.innerHTML = `<div class="loading">Loading curated Marvel merchandise…</div>`;
  let rawProducts = [];
  try {
    rawProducts = await MI_DB.getAffiliateProducts();
  } catch (err) {
    console.warn("[MarvelIndia] Shop products load error, using local:", err);
  }
  if (!rawProducts || !rawProducts.length) {
    rawProducts = (MI_DB.localAffiliateProducts && MI_DB.localAffiliateProducts()) || [];
  }
  const tag = (window.MARVEL_INDIA_CONFIG && window.MARVEL_INDIA_CONFIG.AMAZON_AFFILIATE_TAG) || "";

  let activeCategory = "all";
  let activeSearch = "";
  let activeSort = "featured";

  function getFilteredAndSorted() {
    let list = [...rawProducts];
    if (activeCategory !== "all") {
      list = list.filter(p => (p.category || "").toLowerCase() === activeCategory.toLowerCase());
    }
    if (activeSearch.trim()) {
      const q = activeSearch.trim().toLowerCase();
      list = list.filter(p => 
        (p.title || "").toLowerCase().includes(q) ||
        (p.blurb || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.tag || "").toLowerCase().includes(q)
      );
    }
    if (activeSort === "price-asc") {
      list.sort((a, b) => (a.price_num || 0) - (b.price_num || 0));
    } else if (activeSort === "price-desc") {
      list.sort((a, b) => (b.price_num || 0) - (a.price_num || 0));
    } else if (activeSort === "rating") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (activeSort === "discount") {
      list.sort((a, b) => parseInt(b.discount_percent || "0", 10) - parseInt(a.discount_percent || "0", 10));
    }
    return list;
  }

  function getProductsGridHtml() {
    const items = getFilteredAndSorted();
    if (!items.length) {
      return `
        <div class="comic-panel" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #ffffff;">
          <h3 style="margin-bottom: 8px;">No merchandise matches found</h3>
          <p class="muted" style="margin-bottom: 20px;">Try searching for "Iron Man", "Omnibus", "Action Figure", or reset filters.</p>
          <button type="button" class="pill primary" id="shop-reset-btn">Reset All Filters</button>
        </div>`;
    }
    return items.map(p => {
      let productUrl = p.amazon_url;
      try {
        const u = new URL(p.amazon_url);
        if (tag && tag !== "your-affiliate-tag-21") {
          u.searchParams.set("tag", tag);
        }
        productUrl = u.toString();
      } catch (e) {}

      const fullStars = Math.floor(p.rating || 5);
      const halfStar = (p.rating || 5) % 1 >= 0.5 ? "★" : "";
      const stars = "★".repeat(fullStars) + halfStar;

      return `
        <div class="shop-card-v2 comic-panel" id="product-${esc(p.id)}">
          ${p.tag ? `<span class="shop-card-badge">${esc(p.tag)}</span>` : ""}
          <a href="${productUrl}" target="_blank" rel="noopener sponsored" class="shop-img-box" tabindex="-1" aria-hidden="true">
            <img src="${p.image_url || "assets/placeholder-poster.svg"}" alt="${esc(p.title)}" loading="lazy" onerror="this.onerror=null;this.src='assets/placeholder-poster.svg'">
          </a>
          <div class="shop-card-content">
            <span class="shop-cat-label">${esc(p.category || "Marvel Merch")}</span>
            <h3 class="shop-product-title">
              <a href="${productUrl}" target="_blank" rel="noopener sponsored" style="text-decoration:none;color:inherit;">${esc(p.title)}</a>
            </h3>
            
            <div class="shop-rating-row">
              <span class="shop-stars">${stars}</span>
              <span style="font-weight:700;">${p.rating ? p.rating.toFixed(1) : "4.8"}</span>
              <span class="muted">(${p.review_count ? p.review_count.toLocaleString() : "1,200"} reviews)</span>
            </div>

            <div class="shop-price-box">
              <span class="shop-price-curr">${esc(p.price_label || "₹1,999")}</span>
              ${p.mrp_label ? `<span class="shop-price-mrp">${esc(p.mrp_label)}</span>` : ""}
              ${p.discount_percent ? `<span class="shop-discount-pill">${esc(p.discount_percent)}</span>` : ""}
            </div>

            ${p.prime ? `
            <div class="shop-prime-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <span>Prime Next-Day Delivery eligible</span>
            </div>` : ""}

            <p class="shop-card-blurb">${esc(p.blurb || "")}</p>

            <a class="pill primary full shop-buy-btn" href="${productUrl}" target="_blank" rel="noopener sponsored">
              Buy on Amazon ↗
            </a>
          </div>
        </div>
      `;
    }).join("");
  }

  app.innerHTML = `
    <section class="section">
      <div class="shop-hero-card comic-panel">
        <div class="shop-hero-banner">
          <h1>Marvel India Merchandise &amp; Collectibles</h1>
          <p>Hand-picked, collector-grade Marvel figures, deluxe graphic novel omnibuses, wearable apparel, and life-size prop replicas via Amazon India.</p>
        </div>

        <div class="shop-trust-badges">
          <div class="shop-trust-item">
            <span class="shop-trust-icon">🛡️</span>
            <span>Verified Official Licenses</span>
          </div>
          <div class="shop-trust-item">
            <span class="shop-trust-icon">🚚</span>
            <span>Amazon India Prime Fast Delivery</span>
          </div>
          <div class="shop-trust-item">
            <span class="shop-trust-icon">🏷️</span>
            <span>Real-time Pricing &amp; Deal Tracking</span>
          </div>
        </div>

        <div class="shop-controls-bar">
          <div class="shop-search-inner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="shop-live-search" placeholder="Search figures, hoodies, comics..." value="${esc(activeSearch)}">
            <button type="button" class="shop-search-clear" id="shop-search-clear" style="display:${activeSearch ? "block" : "none"};" aria-label="Clear search">&times;</button>
          </div>

          <div class="shop-sort-wrap">
            <label for="shop-sort-select">Sort by:</label>
            <select id="shop-sort-select" class="shop-sort-select">
              <option value="featured" ${activeSort === "featured" ? "selected" : ""}>Featured Roster</option>
              <option value="rating" ${activeSort === "rating" ? "selected" : ""}>Highest Rated</option>
              <option value="discount" ${activeSort === "discount" ? "selected" : ""}>Biggest Discount</option>
              <option value="price-asc" ${activeSort === "price-asc" ? "selected" : ""}>Price: Low to High</option>
              <option value="price-desc" ${activeSort === "price-desc" ? "selected" : ""}>Price: High to Low</option>
            </select>
          </div>
        </div>

        <div class="shop-category-pills" id="shop-cat-pills">
          <button type="button" class="shop-cat-pill ${activeCategory === "all" ? "active" : ""}" data-cat="all">All Items (${rawProducts.length})</button>
          <button type="button" class="shop-cat-pill ${activeCategory === "collectibles" ? "active" : ""}" data-cat="collectibles">Action Figures</button>
          <button type="button" class="shop-cat-pill ${activeCategory === "books" ? "active" : ""}" data-cat="books">Graphic Novels &amp; Books</button>
          <button type="button" class="shop-cat-pill ${activeCategory === "replica" ? "active" : ""}" data-cat="replica">Replicas &amp; Props</button>
          <button type="button" class="shop-cat-pill ${activeCategory === "wearables" ? "active" : ""}" data-cat="wearables">Streetwear &amp; Apparel</button>
          <button type="button" class="shop-cat-pill ${activeCategory === "desk & gaming" ? "active" : ""}" data-cat="desk & gaming">Desk &amp; Gaming</button>
        </div>
      </div>

      <div class="shop-grid-v2" id="shop-products-container">
        ${getProductsGridHtml()}
      </div>

      <div class="comic-panel" style="margin-top:28px; padding:18px 22px; font-size:0.88rem; color:var(--muted); background:#ffffff;">
        <strong>Affiliate Transparency:</strong> Marvel India participates in the Amazon Services LLC Associates Program. Clicking product links to make qualifying purchases on Amazon.in earns this fan community a modest commission at no extra cost to you, funding our independent server hosting and database costs.
      </div>
    </section>
  `;

  function refreshShopGrid() {
    const container = document.getElementById("shop-products-container");
    if (container) {
      container.innerHTML = getProductsGridHtml();
      document.getElementById("shop-reset-btn")?.addEventListener("click", () => {
        activeCategory = "all";
        activeSearch = "";
        activeSort = "featured";
        const searchInp = document.getElementById("shop-live-search");
        if (searchInp) searchInp.value = "";
        const clearBtn = document.getElementById("shop-search-clear");
        if (clearBtn) clearBtn.style.display = "none";
        const sortSel = document.getElementById("shop-sort-select");
        if (sortSel) sortSel.value = "featured";
        document.querySelectorAll(".shop-cat-pill").forEach(p => p.classList.toggle("active", p.dataset.cat === "all"));
        refreshShopGrid();
      });
    }
  }

  // Category buttons
  document.querySelectorAll("#shop-cat-pills .shop-cat-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      activeCategory = pill.dataset.cat;
      document.querySelectorAll("#shop-cat-pills .shop-cat-pill").forEach(p => p.classList.toggle("active", p === pill));
      refreshShopGrid();
    });
  });

  // Search input
  const liveSearch = document.getElementById("shop-live-search");
  const clearBtn = document.getElementById("shop-search-clear");
  liveSearch?.addEventListener("input", (e) => {
    activeSearch = e.target.value;
    if (clearBtn) clearBtn.style.display = activeSearch ? "block" : "none";
    refreshShopGrid();
  });
  clearBtn?.addEventListener("click", () => {
    activeSearch = "";
    if (liveSearch) liveSearch.value = "";
    clearBtn.style.display = "none";
    refreshShopGrid();
  });

  // Sort dropdown
  document.getElementById("shop-sort-select")?.addEventListener("change", (e) => {
    activeSort = e.target.value;
    refreshShopGrid();
  });

  // Wire initial reset button if present
  document.getElementById("shop-reset-btn")?.addEventListener("click", () => {
    activeCategory = "all";
    activeSearch = "";
    activeSort = "featured";
    refreshShopGrid();
  });
}

// ---------------------------------------------------------------- GLOBAL LOADING SKELETON
let _skeletonHideTimer = null;
let _skeletonMinShowTimestamp = 0;

window.showGlobalSkeleton = function(customLabel) {
  if (_skeletonHideTimer) {
    clearTimeout(_skeletonHideTimer);
    _skeletonHideTimer = null;
  }
  const overlay = document.getElementById("global-skeleton-overlay");
  const labelEl = document.getElementById("skeleton-status-label");
  if (labelEl && customLabel) {
    labelEl.textContent = customLabel;
  }
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    _skeletonMinShowTimestamp = Date.now();
  }
};

window.hideGlobalSkeleton = function(forceImmediate = false) {
  const overlay = document.getElementById("global-skeleton-overlay");
  if (!overlay) return;

  const elapsed = Date.now() - _skeletonMinShowTimestamp;
  const minDisplayTime = forceImmediate ? 0 : 80;
  const remaining = Math.max(0, minDisplayTime - elapsed);

  if (_skeletonHideTimer) clearTimeout(_skeletonHideTimer);
  _skeletonHideTimer = setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    _skeletonHideTimer = null;
  }, remaining);
};

// ---------------------------------------------------------------- ROUTER
function parseHash() {
  const raw = location.hash.slice(1) || "/home";
  const [path, qs] = raw.split("?");
  const params = new URLSearchParams(qs || "");
  return { path, params };
}

function safeRender(renderPromise) {
  return Promise.resolve(renderPromise)
    .catch(err => {
      console.error("[MarvelIndia] Route render failed:", err);
      const appEl = document.getElementById("app");
      if (appEl) {
        appEl.innerHTML = `
          <section class="section" style="text-align: center; padding: 48px 16px;">
            <h2>Unable to load content right now</h2>
            <p class="muted" style="margin: 12px 0 24px;">A network or rendering timeout occurred. You can retry or return to the main hub.</p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button type="button" class="pill primary" onclick="route()">Retry Tab</button>
              <a href="#/home" class="pill">Back to Home</a>
            </div>
          </section>`;
      }
    })
    .finally(() => {
      window.hideGlobalSkeleton();
    });
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

  const routeStatusLabels = {
    home: "ASSEMBLING MULTIVERSE ROSTER...",
    search: "SCANNING MARVEL CINEMATIC DATABASE...",
    movie: "DECRYPTING CANON DOSSIER & STREAMING...",
    trailers: "STREAMING THEATRICAL TEASERS & CLIPS...",
    timeline: "DECIPHERING MCU CHRONOLOGICAL TIMELINE...",
    roadmap: "CALCULATING DOOMSDAY PREPARATION PLAN...",
    blog: "RETRIEVING MARVELITE COMMUNITY THEORIES...",
    shop: "CURATING AUTHENTIC MARVEL COLLECTIBLES...",
    wishlist: "LOADING PERSONAL WATCH WISHLIST...",
    contact: "CONNECTING TO EDITORIAL DISPATCH...",
    privacy: "OPENING PRIVACY DIRECTIVES...",
    terms: "LOADING COMMUNITY CHARTER & TERMS..."
  };
  const statusLabel = routeStatusLabels[top] || "FETCHING IN-UNIVERSE DATA...";
  window.showGlobalSkeleton(statusLabel);

  if (path === "/home" || path === "/") return safeRender(renderHome());
  if (path === "/search") return safeRender(renderSearch(params.get("q")));
  if (path.startsWith("/movie/")) return safeRender(renderMovie(path.split("/")[2]));
  if (path === "/trailers") return safeRender(renderTrailers(params.get("cat")));
  if (path === "/timeline") return safeRender(renderTimeline());
  if (path === "/roadmap") return safeRender(renderRoadmap());
  if (path === "/characters" || path.startsWith("/character/")) {
    window.hideGlobalSkeleton(true);
    location.hash = "#/home";
    return;
  }
  if (path === "/wishlist") return safeRender(renderWishlist());
  if (path === "/blog") return safeRender(renderBlogList());
  if (path === "/blog/new") return safeRender(renderNewBlogForm());
  if (path.startsWith("/blog/")) return safeRender(renderBlogPost(path.split("/")[2]));
  if (path === "/shop") return safeRender(renderShop());
  if (path === "/contact") return safeRender(renderContact());
  if (path === "/verify" || path === "/verify-otp" || path === "/auth/verify") {
    window.hideGlobalSkeleton(true);
    location.hash = "#/home";
    openAuthModal("verify", params.get("email") || "");
    return;
  }
  if (path === "/privacy") return safeRender(renderPrivacyPolicy());
  if (path === "/terms") return safeRender(renderTerms());
  window.hideGlobalSkeleton(true);
  app.innerHTML = `<section class="section"><h1>Page not found</h1><a href="#/home" class="link">← Home</a></section>`;
}

function isDesktopScreen() {
  return window.innerWidth > 900;
}

function closeSidebar(syncHistory = true) {
  if (isDesktopScreen()) {
    document.querySelector(".app-shell")?.classList.add("sidebar-collapsed");
    localStorage.setItem("mi_sidebar_collapsed", "1");
  } else {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sidebar-backdrop")?.classList.remove("open");
    if (syncHistory && history.state && history.state.miSidebar) {
      history.back();
    }
  }
}

function openSidebar() {
  if (isDesktopScreen()) {
    document.querySelector(".app-shell")?.classList.remove("sidebar-collapsed");
    localStorage.setItem("mi_sidebar_collapsed", "0");
  } else {
    if (!history.state || !history.state.miSidebar) {
      history.pushState({ miSidebar: true }, "");
    }
    document.getElementById("sidebar")?.classList.add("open");
    document.getElementById("sidebar-backdrop")?.classList.add("open");
  }
}

function toggleSidebar() {
  if (isDesktopScreen()) {
    const shell = document.querySelector(".app-shell");
    const isCollapsed = shell?.classList.toggle("sidebar-collapsed");
    localStorage.setItem("mi_sidebar_collapsed", isCollapsed ? "1" : "0");
  } else {
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }
}

function initSidebar() {
  const shell = document.querySelector(".app-shell");
  if (isDesktopScreen() && localStorage.getItem("mi_sidebar_collapsed") === "1") {
    shell?.classList.add("sidebar-collapsed");
  }

  document.getElementById("menu-toggle")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleSidebar();
  });
  document.getElementById("sidebar-close")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeSidebar();
  });
  document.getElementById("sidebar-dock-collapse")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeSidebar();
  });
  document.getElementById("desktop-sidebar-expand")?.addEventListener("click", (e) => {
    e.preventDefault();
    openSidebar();
  });
  document.getElementById("sidebar-backdrop")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeSidebar();
  });

  // Footer back-to-top button
  document.getElementById("footer-back-to-top")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Keyboard shortcut Esc collapses/closes sidebar & video modals
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeVideoModal();
      closeSidebar();
    }
  });

  // Sidebar search form submit handler
  const sidebarSearchForm = document.getElementById("sidebar-search-form");
  if (sidebarSearchForm) {
    sidebarSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("sidebar-search-input");
      const val = (input?.value || "").trim();
      if (!isDesktopScreen()) {
        closeSidebar(false);
      }
      if (val) {
        location.hash = `#/search?q=${encodeURIComponent(val)}`;
      } else {
        if (location.hash === "#/search") {
          renderSearch("");
        } else {
          location.hash = "#/search";
        }
      }
    });
  }

  // Sidebar & header search button click handler
  const handleSearchBtnNav = (e) => {
    if (!isDesktopScreen()) {
      closeSidebar(false);
    }
    const currentHash = location.hash || "";
    if (currentHash === "#/search" || currentHash.startsWith("#/search?")) {
      e.preventDefault();
      if (currentHash !== "#/search") {
        location.hash = "#/search";
      } else {
        renderSearch("");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        const inp = document.getElementById("search-input");
        if (inp) {
          inp.value = "";
          inp.focus();
        }
      }, 100);
    }
  };

  document.getElementById("mobile-search-btn")?.addEventListener("click", handleSearchBtnNav);
  document.querySelectorAll('a.navlink[href="#/search"]').forEach(a => {
    a.addEventListener("click", handleSearchBtnNav);
  });

  // Sidebar navigation links - close mobile sidebar cleanly without popping history back
  document.querySelectorAll(".sidebar-nav .navlink").forEach(a => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!isDesktopScreen()) {
        closeSidebar(false);
      }
      if (location.hash === href) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
}

window.addEventListener("popstate", () => {
  const modalRoot = document.getElementById("modal-root");
  if (modalRoot && modalRoot.children.length > 0) {
    closeModal(false);
    return;
  }
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    closeSidebar(false);
    return;
  }
});
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
