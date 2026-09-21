/**
 * Every read/write against the Supabase database and storage buckets lives
 * here. Nothing in the app reads from a bundled JS array anymore — movies,
 * timeline events, characters, blog posts and affiliate products are all
 * rows in Postgres (see supabase/01_schema.sql + 02_seed.sql).
 *
 * Every function fails soft (returns [] / null and logs a warning) so a
 * missing Supabase config doesn't crash the whole page — the UI shows an
 * empty state with a pointer back to the README instead.
 */
const MI_DB = (() => {
  function sb() { return MI_SUPABASE.client; }
  function guard(fallback) {
    if (!MI_SUPABASE.ready) { console.warn("[MarvelIndia] Supabase not configured — see README."); return fallback; }
    return null;
  }

  function localRoadmap() {
    if (!window.MI_ROADMAP) return [];
    return window.MI_ROADMAP.map((m, idx) => ({
      id: m.id || m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: m.title,
      year: m.year,
      phase: m.phase,
      saga: m.phase === "phase6" || m.phase === "phase5" || m.phase === "phase4" ? "Multiverse Saga" : "Infinity Saga",
      status: m.status || "released",
      release_date: m.releaseDate || `${m.year}-05-01`,
      runtime_minutes: m.runtimeMinutes || 120,
      priority: m.priority || "must-watch",
      synopsis: m.synopsisFallback || null,
      tmdb_query: m.tmdbQuery,
      spotlight: !!m.spotlight,
      sort_order: (idx + 1) * 10
    }));
  }

  function localTimeline() {
    if (!window.MI_TIMELINE) return [];
    return window.MI_TIMELINE.map((t, idx) => ({
      id: idx + 1,
      movie_title: t.title,
      year_label: t.year,
      blurb: t.blurb,
      spotlight: !!t.spotlight,
      sort_order: (idx + 1) * 10
    }));
  }

  function localCharacters() {
    if (!window.MI_CHARACTERS) return [];
    return window.MI_CHARACTERS.map((c, idx) => ({
      id: idx + 1,
      name: c.name,
      actor: c.actor,
      powers: c.powers,
      first_appearance: c.firstAppearance,
      affiliation: c.affiliation,
      sort_order: (idx + 1) * 10
    }));
  }

  // ------------------------------------------------------------- movies
  async function getRoadmap() {
    const bail = guard(null);
    if (bail !== null) return localRoadmap();
    try {
      const { data, error } = await sb().from("movies").select("*").order("sort_order");
      if (error || !data || !data.length) return localRoadmap();
      return data;
    } catch {
      return localRoadmap();
    }
  }
  async function getMovie(id) {
    const bail = guard(null);
    if (bail !== null) return localRoadmap().find(m => m.id === id) || null;
    try {
      const { data, error } = await sb().from("movies").select("*").eq("id", id).single();
      if (error || !data) return localRoadmap().find(m => m.id === id) || null;
      return data;
    } catch {
      return localRoadmap().find(m => m.id === id) || null;
    }
  }
  async function getSpotlightMovie() {
    const bail = guard(null);
    if (bail !== null) return localRoadmap().find(m => m.spotlight) || localRoadmap()[localRoadmap().length - 1] || null;
    try {
      const { data, error } = await sb().from("movies").select("*").eq("spotlight", true).limit(1).maybeSingle();
      if (error || !data) return localRoadmap().find(m => m.spotlight) || localRoadmap()[localRoadmap().length - 1] || null;
      return data;
    } catch {
      return localRoadmap().find(m => m.spotlight) || localRoadmap()[localRoadmap().length - 1] || null;
    }
  }

  // ------------------------------------------------------------- timeline
  async function getTimeline() {
    const bail = guard(null);
    if (bail !== null) return localTimeline();
    try {
      const { data, error } = await sb().from("timeline_events").select("*").order("sort_order");
      if (error || !data || !data.length) return localTimeline();
      return data;
    } catch {
      return localTimeline();
    }
  }

  // ------------------------------------------------------------- characters
  async function getCharacters() {
    const bail = guard(null);
    if (bail !== null) return localCharacters();
    try {
      const { data, error } = await sb().from("characters").select("*").order("sort_order");
      if (error || !data || !data.length) return localCharacters();
      return data;
    } catch {
      return localCharacters();
    }
  }
  async function getCharacterById(id) {
    const bail = guard(null);
    if (bail !== null) return localCharacters().find(c => String(c.id) === String(id)) || null;
    try {
      const { data, error } = await sb().from("characters").select("*").eq("id", id).single();
      if (error || !data) return localCharacters().find(c => String(c.id) === String(id)) || null;
      return data;
    } catch {
      return localCharacters().find(c => String(c.id) === String(id)) || null;
    }
  }

  // ------------------------------------------------------------- wishlist
  async function getWishlist(userId) {
    const bail = guard([]); if (bail) return bail;
    if (!userId) return [];
    const { data, error } = await sb().from("wishlist").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  }
  async function isWishlisted(userId, itemId, itemType = "movie") {
    if (!userId) return false;
    const bail = guard(false); if (bail !== null && bail !== false) return bail;
    if (!MI_SUPABASE.ready) return false;
    const { data } = await sb().from("wishlist").select("id").eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType).maybeSingle();
    return !!data;
  }
  async function toggleWishlist(userId, item) {
    if (!userId) return { ok: false, error: "Sign up or log in to build a wishlist." };
    const already = await isWishlisted(userId, item.id, item.type || "movie");
    if (already) {
      const { error } = await sb().from("wishlist").delete().eq("user_id", userId).eq("item_id", item.id).eq("item_type", item.type || "movie");
      if (error) return { ok: false, error: error.message };
      return { ok: true, inWishlist: false };
    }
    const { error } = await sb().from("wishlist").insert({
      user_id: userId, item_id: item.id, item_type: item.type || "movie", title: item.title, poster_url: item.poster || null
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, inWishlist: true };
  }

  // ------------------------------------------------------------- comments
  async function getComments(itemType, itemId) {
    const bail = guard([]); if (bail) return bail;
    const { data, error } = await sb()
      .from("comments").select("id, body, created_at, user_id, profiles(username, avatar_url)")
      .eq("item_type", itemType).eq("item_id", itemId).order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  }
  async function addComment(userId, itemType, itemId, body) {
    if (!userId) return { ok: false, error: "Sign up or log in to comment." };
    if (!body || !body.trim()) return { ok: false, error: "Comment can't be empty." };
    const { error } = await sb().from("comments").insert({ user_id: userId, item_type: itemType, item_id: itemId, body: body.trim() });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // ------------------------------------------------------------- watch progress
  async function getWatchedIds(userId) {
    const bail = guard([]); if (bail) return bail;
    if (!userId) return [];
    const { data, error } = await sb().from("watch_progress").select("movie_id").eq("user_id", userId).eq("watched", true);
    if (error) { console.error(error); return []; }
    return data.map(r => r.movie_id);
  }
  async function toggleWatched(userId, movieId, nowWatched) {
    if (!userId) return { ok: false, error: "Sign up or log in to track progress." };
    if (nowWatched) {
      const { error } = await sb().from("watch_progress").upsert({ user_id: userId, movie_id: movieId, watched: true, watched_at: new Date().toISOString() });
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb().from("watch_progress").delete().eq("user_id", userId).eq("movie_id", movieId);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  // ------------------------------------------------------------- blog
  async function getBlogPosts() {
    const bail = guard([]); if (bail) return bail;
    const { data, error } = await sb()
      .from("blog_posts").select("id, title, slug, cover_image_url, body, tags, created_at, author_id, profiles(username, avatar_url)")
      .eq("published", true).order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  }
  async function getBlogPost(slug) {
    const bail = guard(null); if (bail) return bail;
    const { data, error } = await sb()
      .from("blog_posts").select("id, title, slug, cover_image_url, body, tags, created_at, author_id, profiles(username, avatar_url)")
      .eq("slug", slug).single();
    if (error) { console.error(error); return null; }
    return data;
  }
  function slugify(title) {
    return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
  }
  async function createBlogPost(userId, { title, body, tags, coverFile }) {
    if (!userId) return { ok: false, error: "Sign up or log in to publish." };
    if (!title || !title.trim() || !body || !body.trim()) return { ok: false, error: "Title and body are required." };
    let coverUrl = null;
    if (coverFile) {
      const upload = await uploadBlogCover(userId, coverFile);
      if (!upload.ok) return upload;
      coverUrl = upload.url;
    }
    const slug = slugify(title);
    const { error } = await sb().from("blog_posts").insert({
      author_id: userId, title: title.trim(), slug, body: body.trim(),
      tags: (tags || "").split(",").map(t => t.trim()).filter(Boolean),
      cover_image_url: coverUrl
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, slug };
  }
  async function getBlogComments(postId) {
    const bail = guard([]); if (bail) return bail;
    const { data, error } = await sb()
      .from("blog_comments").select("id, body, created_at, user_id, profiles(username, avatar_url)")
      .eq("post_id", postId).order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return data;
  }
  async function addBlogComment(userId, postId, body) {
    if (!userId) return { ok: false, error: "Sign up or log in to comment." };
    if (!body || !body.trim()) return { ok: false, error: "Comment can't be empty." };
    const { error } = await sb().from("blog_comments").insert({ user_id: userId, post_id: postId, body: body.trim() });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // ------------------------------------------------------------- affiliate products
  async function getAffiliateProducts() {
    const bail = guard([]); if (bail) return bail;
    const { data, error } = await sb().from("affiliate_products").select("*").order("sort_order");
    if (error) { console.error(error); return []; }
    return data;
  }

  // ------------------------------------------------------------- storage uploads
  async function uploadAvatar(userId, file) {
    const path = `${userId}/avatar.${file.name.split(".").pop()}`;
    const { error } = await sb().storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return { ok: false, error: error.message };
    const { data } = sb().storage.from("avatars").getPublicUrl(path);
    await sb().from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
    return { ok: true, url: data.publicUrl };
  }
  async function uploadBlogCover(userId, file) {
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await sb().storage.from("blog-covers").upload(path, file);
    if (error) return { ok: false, error: error.message };
    const { data } = sb().storage.from("blog-covers").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  }

  // ------------------------------------------------------------- profile
  async function getProfile(userId) {
    const bail = guard(null); if (bail) return bail;
    if (!userId) return null;
    const { data, error } = await sb().from("profiles").select("*").eq("id", userId).single();
    if (error) { console.error(error); return null; }
    return data;
  }
  async function setNotificationsEnabled(userId, enabled) {
    if (!userId) return { ok: false };
    const { error } = await sb().from("profiles").update({ notifications_enabled: enabled }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return {
    getRoadmap, getMovie, getSpotlightMovie,
    getTimeline,
    getCharacters, getCharacterById,
    getWishlist, isWishlisted, toggleWishlist,
    getComments, addComment,
    getWatchedIds, toggleWatched,
    getBlogPosts, getBlogPost, createBlogPost, getBlogComments, addBlogComment,
    getAffiliateProducts,
    uploadAvatar, uploadBlogCover,
    getProfile, setNotificationsEnabled
  };
})();
