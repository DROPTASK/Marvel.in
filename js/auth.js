/**
 * Client-side demo auth/wishlist/comments.
 * IMPORTANT: this stores everything in localStorage, in this one browser.
 * It's enough to demo "signup, then wishlist / comment" end-to-end, but a
 * real deployment needs a real backend (Supabase/Firebase/your own API) so
 * accounts, wishlists and comments are shared across devices and not
 * readable by anyone with dev-tools access to the browser.
 */
const MI_AUTH = (() => {
  const USERS_KEY = "mi_users";
  const SESSION_KEY = "mi_session";
  const WISHLIST_PREFIX = "mi_wishlist_";
  const COMMENTS_KEY = "mi_comments";
  const WATCHED_KEY = "mi_watched_";

  function loadUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  // Not real security — a simple non-reversible-looking hash so plaintext
  // passwords at least aren't sitting in localStorage. Do not reuse this
  // pattern for anything that matters.
  function weakHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return "h" + h;
  }

  function signup(username, password) {
    username = username.trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Username and password are required." };
    const users = loadUsers();
    if (users[username]) return { ok: false, error: "That username is already taken." };
    users[username] = { password: weakHash(password), joined: new Date().toISOString() };
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, username);
    return { ok: true, username };
  }

  function login(username, password) {
    username = username.trim().toLowerCase();
    const users = loadUsers();
    const record = users[username];
    if (!record || record.password !== weakHash(password)) {
      return { ok: false, error: "Incorrect username or password." };
    }
    localStorage.setItem(SESSION_KEY, username);
    return { ok: true, username };
  }

  function logout() { localStorage.removeItem(SESSION_KEY); }
  function currentUser() { return localStorage.getItem(SESSION_KEY); }

  // ---- Wishlist ---------------------------------------------------------
  function wishlistKey(user) { return WISHLIST_PREFIX + user; }
  function getWishlist(user) {
    if (!user) return [];
    return JSON.parse(localStorage.getItem(wishlistKey(user)) || "[]");
  }
  function toggleWishlist(user, item) {
    if (!user) return { ok: false, error: "Sign up or log in to build a wishlist." };
    const list = getWishlist(user);
    const idx = list.findIndex(i => i.id === item.id && i.type === item.type);
    if (idx >= 0) { list.splice(idx, 1); }
    else { list.push(item); }
    localStorage.setItem(wishlistKey(user), JSON.stringify(list));
    return { ok: true, inWishlist: idx < 0 };
  }
  function isWishlisted(user, id, type) {
    if (!user) return false;
    return getWishlist(user).some(i => i.id === id && i.type === type);
  }

  // ---- Comments (per title, keyed by "type:id") --------------------------
  function loadComments() { return JSON.parse(localStorage.getItem(COMMENTS_KEY) || "{}"); }
  function saveComments(c) { localStorage.setItem(COMMENTS_KEY, JSON.stringify(c)); }
  function getComments(key) { return loadComments()[key] || []; }
  function addComment(user, key, text) {
    if (!user) return { ok: false, error: "Sign up or log in to comment." };
    if (!text || !text.trim()) return { ok: false, error: "Comment can't be empty." };
    const all = loadComments();
    all[key] = all[key] || [];
    all[key].push({ user, text: text.trim(), at: new Date().toISOString() });
    saveComments(all);
    return { ok: true };
  }

  // ---- Roadmap "watched" checkboxes --------------------------------------
  function watchedKey(user) { return WATCHED_KEY + (user || "guest"); }
  function getWatched(user) { return JSON.parse(localStorage.getItem(watchedKey(user)) || "[]"); }
  function toggleWatched(user, title) {
    const list = getWatched(user);
    const idx = list.indexOf(title);
    if (idx >= 0) list.splice(idx, 1); else list.push(title);
    localStorage.setItem(watchedKey(user), JSON.stringify(list));
    return list;
  }

  return {
    signup, login, logout, currentUser,
    getWishlist, toggleWishlist, isWishlisted,
    getComments, addComment,
    getWatched, toggleWatched
  };
})();
