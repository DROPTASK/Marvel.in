/**
 * Supabase-auth wrapper. Every function is async and returns
 * { ok: true, ... } or { ok: false, error }, matching the shape the UI
 * code in app.js expects.
 *
 * A profile row (username, avatar, notifications flag) is created
 * automatically by a database trigger the moment someone signs up — see
 * supabase/01_schema.sql `handle_new_user()`.
 */
const MI_AUTH = (() => {
  function sb() { return MI_SUPABASE.client; }
  let cachedUser = null;

  async function init() {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) return null;
    const { data } = await sb().auth.getSession();
    cachedUser = data.session ? data.session.user : null;
    sb().auth.onAuthStateChange((_event, session) => {
      cachedUser = session ? session.user : null;
      window.dispatchEvent(new CustomEvent("mi-auth-changed"));
    });
    return cachedUser;
  }

  function currentUser() { return cachedUser; }
  function currentUserId() { return cachedUser ? cachedUser.id : null; }
  function currentUsername() {
    if (!cachedUser) return null;
    return cachedUser.user_metadata && cachedUser.user_metadata.username || cachedUser.email;
  }

  async function signup(username, email, password) {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) return { ok: false, error: "Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not set. Please set them in your deployment environment variables." };
    if (!username || !email || !password) return { ok: false, error: "Username, email and password are all required." };
    const { data, error } = await sb().auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (error) return { ok: false, error: error.message };
    cachedUser = data.user;
    return { ok: true, needsEmailConfirm: !data.session };
  }

  async function login(email, password) {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) return { ok: false, error: "Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not set. Please set them in your deployment environment variables." };
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    cachedUser = data.user;
    return { ok: true };
  }

  async function logout() {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) return;
    await sb().auth.signOut();
    cachedUser = null;
  }

  async function sendOtp(email, username) {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) return { ok: false, error: "Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not set in environment." };
    if (!email || !email.includes("@")) return { ok: false, error: "Please enter a valid email address." };
    const options = { shouldCreateUser: true };
    if (username && username.trim()) {
      options.data = { username: username.trim() };
    }
    const { error } = await sb().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function verifyOtp(email, token, type = "signup") {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) {
      return { ok: false, error: "Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not set in environment." };
    }
    const cleanToken = (token || "").replace(/\s+/g, "").trim();
    if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
      return { ok: false, error: "Please enter a valid 6-digit numeric verification code." };
    }
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, error: "Please provide a valid email address." };
    }
    
    const typesToTry = [type || "signup", type === "signup" ? "email" : "signup", "magiclink"];
    let lastError = null;

    for (const t of typesToTry) {
      if (!t) continue;
      try {
        const res = await sb().auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: t
        });
        if (!res.error && (res.data.session || res.data.user)) {
          cachedUser = res.data.user || (res.data.session ? res.data.session.user : null);
          window.dispatchEvent(new CustomEvent("mi-auth-changed"));
          return { ok: true, user: cachedUser };
        }
        if (res.error) lastError = res.error;
      } catch (err) {
        lastError = err;
      }
    }

    return { ok: false, error: (lastError && lastError.message) || "Invalid or expired verification code. Please check and try again." };
  }

  async function resendVerificationOtp(email, type = "signup") {
    await MI_SUPABASE.ensureReady?.();
    if (!MI_SUPABASE.ready) {
      return { ok: false, error: "Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not set." };
    }
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, error: "Please provide a valid email address." };
    }
    try {
      const { error } = await sb().auth.resend({
        type: type || "signup",
        email: cleanEmail
      });
      if (error) {
        return sendOtp(cleanEmail);
      }
      return { ok: true };
    } catch {
      return sendOtp(cleanEmail);
    }
  }

  return { init, currentUser, currentUserId, currentUsername, signup, login, logout, sendOtp, verifyOtp, resendVerificationOtp };
})();
