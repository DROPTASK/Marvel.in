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
      saga: m.phase === "xmen" ? "Mutant Saga" : m.phase === "series" ? "Disney+ Series" : (m.phase === "phase6" || m.phase === "phase5" || m.phase === "phase4" ? "Multiverse Saga" : "Infinity Saga"),
      type: m.type || (m.phase === "xmen" ? "xmen" : m.phase === "series" ? "series" : "movie"),
      status: m.status || "released",
      release_date: m.releaseDate || `${m.year}-05-01`,
      runtime_minutes: m.runtimeMinutes || 120,
      priority: m.priority || "must-watch",
      synopsis: m.synopsisFallback || null,
      poster: m.poster || null,
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

  function normTitle(t) {
    return (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // ------------------------------------------------------------- movies
  async function getRoadmap() {
    const local = localRoadmap();
    const bail = guard(null);
    if (bail !== null) return local;
    try {
      const { data, error } = await sb().from("movies").select("*").order("sort_order");
      if (error || !data || !data.length) return local;

      // Merge DB records with local catalog by normalized title.
      // This GUARANTEES that there are ZERO dual movies, and that the high-resolution
      // poster/banner from the local catalog is preserved on every single title.
      const map = new Map();
      local.forEach(m => {
        map.set(normTitle(m.title), { ...m });
      });

      data.forEach(dbItem => {
        if (!dbItem || !dbItem.title) return;
        const key = normTitle(dbItem.title);
        const existing = map.get(key);

        const safePoster = (existing && existing.poster && existing.poster !== "assets/placeholder-poster.svg")
          ? existing.poster
          : ((dbItem.poster && String(dbItem.poster).startsWith("http")) ? dbItem.poster : null);

        if (existing) {
          map.set(key, {
            ...existing,
            ...dbItem,
            db_id: dbItem.id,
            id: dbItem.id || existing.id,
            poster: safePoster,
            type: existing.type || dbItem.type || (dbItem.phase === "xmen" ? "xmen" : dbItem.phase === "series" ? "series" : "movie"),
            status: dbItem.status || existing.status,
            runtime_minutes: dbItem.runtime_minutes || existing.runtime_minutes,
            priority: dbItem.priority || existing.priority,
            synopsis: dbItem.synopsis || existing.synopsis,
            tmdb_query: dbItem.tmdb_query || existing.tmdb_query
          });
        } else {
          // If DB has a title not in local, add it but try to enrich poster if missing
          map.set(key, {
            ...dbItem,
            db_id: dbItem.id,
            poster: safePoster,
            type: dbItem.type || (dbItem.phase === "xmen" ? "xmen" : dbItem.phase === "series" ? "series" : "movie")
          });
        }
      });

      // Filter out duplicates and return sorted
      const result = Array.from(map.values())
        .filter(m => m && m.title)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      return result;
    } catch {
      return local;
    }
  }

  async function getMovie(id) {
    if (!id) return null;
    const cleanId = String(id).toLowerCase().trim();
    const cleanKey = normTitle(cleanId);
    const list = await getRoadmap();

    // Match against id, db_id, title slug, or normalized title
    const found = list.find(m =>
      String(m.id || "").toLowerCase() === cleanId ||
      String(m.db_id || "").toLowerCase() === cleanId ||
      normTitle(m.title) === cleanKey ||
      normTitle(m.id) === cleanKey
    );
    if (found) return found;

    const bail = guard(null);
    if (bail !== null) return null;
    try {
      const { data, error } = await sb().from("movies").select("*").eq("id", id).maybeSingle();
      if (error || !data) return null;
      const local = localRoadmap().find(m => normTitle(m.title) === normTitle(data.title));
      return {
        ...data,
        poster: (local && local.poster && local.poster !== "assets/placeholder-poster.svg")
          ? local.poster
          : ((data.poster && String(data.poster).startsWith("http")) ? data.poster : null)
      };
    } catch {
      return null;
    }
  }

  async function getSpotlightMovie() {
    const list = await getRoadmap();
    return list.find(m => m.spotlight) ||
      list.find(m => m.status === "upcoming" && m.title.includes("Doomsday")) ||
      list.find(m => m.status === "upcoming") ||
      list[list.length - 1] ||
      null;
  }

  // ------------------------------------------------------------- timeline
  async function getTimeline() {
    const local = localTimeline();
    const bail = guard(null);
    if (bail !== null) return local;
    try {
      const { data, error } = await sb().from("timeline_events").select("*").order("sort_order");
      if (error || !data || !data.length) return local;

      // Merge and deduplicate by normalized movie title so no events appear twice
      const seen = new Set(data.map(d => normTitle(d.movie_title)));
      const extra = local.filter(t => !seen.has(normTitle(t.movie_title)));
      return [...data, ...extra].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    } catch {
      return local;
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

  // Helper to enrich items with profile info (username, avatar) without requiring
  // PostgREST foreign key relationship in the database schema cache
  async function enrichWithProfiles(items, userIdField = "user_id") {
    if (!items || !items.length) return items || [];
    const bail = guard(null);
    if (bail !== null) return items;

    const userIds = [...new Set(items.map(item => item[userIdField]).filter(Boolean))];
    if (!userIds.length) return items;

    try {
      const { data: profs, error } = await sb()
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (error || !profs) {
        return items.map(it => ({
          ...it,
          profiles: it.profiles || { username: "Marvel Fan", avatar_url: null }
        }));
      }

      const pMap = new Map(profs.map(p => [p.id, p]));
      return items.map(it => ({
        ...it,
        profiles: it.profiles || pMap.get(it[userIdField]) || { username: "Marvel Fan", avatar_url: null }
      }));
    } catch {
      return items.map(it => ({
        ...it,
        profiles: it.profiles || { username: "Marvel Fan", avatar_url: null }
      }));
    }
  }

  // ------------------------------------------------------------- comments
  async function getComments(itemType, itemId) {
    const bail = guard([]); if (bail) return bail;
    try {
      const { data, error } = await sb()
        .from("comments")
        .select("id, body, created_at, user_id")
        .eq("item_type", itemType)
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        if (error) console.error("getComments error:", error.message || error);
        return [];
      }
      return await enrichWithProfiles(data, "user_id");
    } catch (err) {
      console.error("getComments exception:", err);
      return [];
    }
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
  function localBlogPosts() {
    return [
      {
        id: "post-1",
        title: "The Road to Avengers: Doomsday — Multiverse Incursions & Doctor Doom Explained",
        slug: "road-to-avengers-doomsday-incursions",
        cover_image_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80",
        body: "With Robert Downey Jr. returning as Victor von Doom, the Multiverse Saga is barreling toward its most consequential crisis since the Infinity Gauntlet.\n\nIn Marvel Comics lore, an incursion happens when the boundary between two parallel universes deteriorates, causing Earths to collide at their exact center point. If neither Earth is destroyed, both entire universes are annihilated. In Jonathan Hickman's legendary Secret Wars storyline, Doom harnessed cosmic powers when the multiverse shattered, gathering remnants onto Battleworld.\n\nHere in the MCU, incursions were first introduced in Doctor Strange in the Multiverse of Madness through Earth-838's Illuminati, followed by Clea warning Stephen Strange. With Avengers: Doomsday approaching, branches originating from Loki, The Marvels, and Deadpool & Wolverine are on a direct collision course.",
        tags: ["theory", "doomsday", "phase6", "incursions"],
        created_at: "2026-09-15T10:00:00Z",
        profiles: { username: "DoomScholar", avatar_url: null }
      },
      {
        id: "post-2",
        title: "The Fantastic Four: First Steps — Why the 1960s Retro-Future Setting is Pure Genius",
        slug: "fantastic-four-first-steps-1960s-retro-future",
        cover_image_url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
        body: "Director Matt Shakman is taking Marvel's First Family somewhere they have always belonged: a gleaming, retro-futuristic 1960s New York City where the space race is supercharged by cosmic energy exploration.\n\nBy placing Reed Richards, Sue Storm, Johnny Storm, and Ben Grimm in an alternate branch of the multiverse, Marvel Studios neatly dodges the question of 'where were they during Thanos?'. More importantly, it allows the team to be presented in their truest comic essence — courageous cosmic explorers and a tight-knit family unit first, superheroes second.\n\nWith Ralph Ineson voicing the world-devourer Galactus and Julia Garner as Shalla-Bal / Silver Surfer, First Steps promises to deliver the cosmic gravitas needed to usher in Phase Six.",
        tags: ["fantastic-four", "phase5", "preview", "retro-future"],
        created_at: "2026-09-10T14:30:00Z",
        profiles: { username: "BaxterBuilding", avatar_url: null }
      },
      {
        id: "post-3",
        title: "Captain America: Brave New World & The Celestial Island Geopolitical Arms Race",
        slug: "brave-new-world-celestial-island-geopolitics",
        cover_image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
        body: "Sam Wilson's first theatrical mission as Captain America restores the grounded political tension that made The Winter Soldier an all-time classic.\n\nThe petrified Celestial Tiamut emerging from the Indian Ocean has ignited an international arms race for newly discovered Adamantium deposits. Between President Thaddeus 'Thunderbolt' Ross, Giancarlo Esposito's lethal Sidewinder, and mysterious covert operations, Wilson must lead without super-soldier serum — relying instead on unmatched tactical instincts and flight combat prowess.\n\nThis thriller directly links the monumental scale of Eternals with the gritty espionage at the heart of the MCU.",
        tags: ["captain-america", "phase5", "adamantium", "geopolitics"],
        created_at: "2026-09-02T18:15:00Z",
        profiles: { username: "VibraniumAnalyst", avatar_url: null }
      }
    ];
  }

  async function getBlogPosts() {
    const bail = guard(null);
    if (bail !== null) return localBlogPosts();
    try {
      const { data, error } = await sb()
        .from("blog_posts")
        .select("id, title, slug, cover_image_url, body, tags, created_at, author_id")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error || !data || !data.length) return localBlogPosts();
      return await enrichWithProfiles(data, "author_id");
    } catch {
      return localBlogPosts();
    }
  }

  async function getBlogPost(slug) {
    const bail = guard(null);
    if (bail !== null) return localBlogPosts().find(p => p.slug === slug) || null;
    try {
      const { data, error } = await sb()
        .from("blog_posts")
        .select("id, title, slug, cover_image_url, body, tags, created_at, author_id")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) return localBlogPosts().find(p => p.slug === slug) || null;
      const [enriched] = await enrichWithProfiles([data], "author_id");
      return enriched || data;
    } catch {
      return localBlogPosts().find(p => p.slug === slug) || null;
    }
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
    try {
      const { data, error } = await sb()
        .from("blog_comments")
        .select("id, body, created_at, user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error || !data) {
        if (error) console.error("getBlogComments error:", error.message || error);
        return [];
      }
      return await enrichWithProfiles(data, "user_id");
    } catch (err) {
      console.error("getBlogComments exception:", err);
      return [];
    }
  }
  async function addBlogComment(userId, postId, body) {
    if (!userId) return { ok: false, error: "Sign up or log in to comment." };
    if (!body || !body.trim()) return { ok: false, error: "Comment can't be empty." };
    const { error } = await sb().from("blog_comments").insert({ user_id: userId, post_id: postId, body: body.trim() });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // ------------------------------------------------------------- affiliate products
  function localAffiliateProducts() {
    return [
      {
        id: "prod-1",
        title: "Marvel Legends Series Iron Man Nano Gauntlet",
        category: "Collectibles",
        price_label: "₹9,999",
        blurb: "Articulated electronic fist featuring pulsating Infinity Stone light effects and movie-inspired sound FX.",
        image_url: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B083TBH775"
      },
      {
        id: "prod-2",
        title: "Marvel Studios: The Marvel Cinematic Universe An Official Timeline",
        category: "Books",
        price_label: "₹2,499",
        blurb: "The definitive guide written by Marvel Studios filmmakers answering every question about MCU chronology and lore.",
        image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/0744081679"
      },
      {
        id: "prod-3",
        title: "Captain America 24-Inch Shield 75th Anniversary Edition",
        category: "Replica",
        price_label: "₹14,999",
        blurb: "Full 1:1 scale premium metal replica with adjustable leather straps and museum-grade finish.",
        image_url: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B01B44MRDC"
      },
      {
        id: "prod-4",
        title: "Doctor Strange Eye of Agamotto Electronic Talisman",
        category: "Collectibles",
        price_label: "₹4,999",
        blurb: "Features glowing green Time Stone mechanism and collector pedestal display stand.",
        image_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B09H1TB3R8"
      }
    ];
  }

  async function getAffiliateProducts() {
    const bail = guard(null);
    if (bail !== null) return localAffiliateProducts();
    try {
      const { data, error } = await sb().from("affiliate_products").select("*").order("sort_order");
      if (error || !data || !data.length) return localAffiliateProducts();
      return data;
    } catch {
      return localAffiliateProducts();
    }
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
