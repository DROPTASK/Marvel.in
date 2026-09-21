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
    if (!MI_SUPABASE.ready) return { ok: false, error: "Supabase isn't configured yet — see README." };
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
    if (!MI_SUPABASE.ready) return { ok: false, error: "Supabase isn't configured yet — see README." };
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

  return { init, currentUser, currentUserId, currentUsername, signup, login, logout };
})();
