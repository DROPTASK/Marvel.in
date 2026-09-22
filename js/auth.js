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
    if (!MI_SUPABASE.ready) return { ok: false, error: "Database service is initializing. Please try again in a moment." };
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
    if (!MI_SUPABASE.ready) return { ok: false, error: "Database service is initializing. Please try again in a moment." };
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    cachedUser = data.user;
    return { ok: true };
  }

  async function logout() {
    if (!MI_SUPABASE.ready) return;
    await sb().auth.signOut();
    cachedUser = null;
  }

  async function sendOtp(email, username) {
    if (!MI_SUPABASE.ready) return { ok: false, error: "Database service not configured." };
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
    if (!MI_SUPABASE.ready) return { ok: false, error: "Database service not configured." };
    const cleanToken = (token || "").replace(/\s+/g, "").trim();
    if (!cleanToken || cleanToken.length !== 6) {
      return { ok: false, error: "Please enter a valid 6-digit verification code." };
    }
    const cleanEmail = (email || "").trim().toLowerCase();
    
    let res = await sb().auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: type
    });
    
    if (res.error) {
      const altType = type === "signup" ? "email" : "signup";
      const retryRes = await sb().auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: altType
      });
      if (!retryRes.error) res = retryRes;
    }

    if (res.error) return { ok: false, error: res.error.message };
    cachedUser = res.data.user || (res.data.session ? res.data.session.user : null);
    window.dispatchEvent(new CustomEvent("mi-auth-changed"));
    return { ok: true, user: cachedUser };
  }

  async function resendVerificationOtp(email, type = "signup") {
    if (!MI_SUPABASE.ready) return { ok: false, error: "Database service not configured." };
    const cleanEmail = (email || "").trim().toLowerCase();
    const { error } = await sb().auth.resend({
      type: type,
      email: cleanEmail
    });
    if (error) {
      return sendOtp(cleanEmail);
    }
    return { ok: true };
  }

  return { init, currentUser, currentUserId, currentUsername, signup, login, logout, sendOtp, verifyOtp, resendVerificationOtp };
})();
