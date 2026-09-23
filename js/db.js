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
  function sb() { return (window.MI_SUPABASE && window.MI_SUPABASE.client) || null; }
  function isReady() {
    return !!(window.MI_SUPABASE && window.MI_SUPABASE.ready && sb());
  }

  async function withTimeout(promise, timeoutMs = 4000) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Database query timed out")), timeoutMs);
    });
    try {
      const res = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  function localRoadmap() {
    if (!window.MI_ROADMAP) return [];
    return window.MI_ROADMAP.map((m, idx) => {
      const isDoomsday = m.title && m.title.includes("Doomsday");
      const defDate = isDoomsday ? "2026-12-18" : (m.status === "upcoming" ? `${m.year}-12-18` : `${m.year}-05-01`);
      return {
        id: m.id || m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: m.title,
        year: m.year,
        phase: m.phase,
        saga: m.phase === "xmen" ? "Mutant Saga" : m.phase === "series" ? "Disney+ Series" : (m.phase === "phase6" || m.phase === "phase5" || m.phase === "phase4" ? "Multiverse Saga" : "Infinity Saga"),
        type: m.type || (m.phase === "xmen" ? "xmen" : m.phase === "series" ? "series" : "movie"),
        status: m.status || "released",
        release_date: m.releaseDate || defDate,
        runtime_minutes: m.runtimeMinutes || 120,
        priority: m.priority || "must-watch",
        synopsis: m.synopsisFallback || null,
        poster: m.poster || null,
        tmdb_query: m.tmdbQuery,
        spotlight: isDoomsday || !!m.spotlight,
        sort_order: (idx + 1) * 10
      };
    });
  }

  function getCustomMovies() {
    try {
      return JSON.parse(localStorage.getItem("mi_custom_movies") || "{}");
    } catch {
      return {};
    }
  }

  function setCustomMovieLocal(movie) {
    try {
      const custom = getCustomMovies();
      custom[movie.id] = movie;
      localStorage.setItem("mi_custom_movies", JSON.stringify(custom));
    } catch {}
  }

  function deleteCustomMovieLocal(id) {
    try {
      const custom = getCustomMovies();
      delete custom[id];
      localStorage.setItem("mi_custom_movies", JSON.stringify(custom));
    } catch {}
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
    let dbData = [];

    if (isReady()) {
      try {
        const { data, error } = await withTimeout(sb().from("movies").select("*").order("sort_order"), 4000);
        if (!error && data && data.length) {
          dbData = data;
        }
      } catch (err) {
        console.warn("[MarvelIndia] Could not fetch movies from Supabase (using local):", err);
      }
    }

    // When database has data, treat it as the live authoritative source of truth!
    if (dbData && dbData.length > 0) {
      const localMap = new Map();
      local.forEach(m => localMap.set(normTitle(m.title), m));

      return dbData.map(dbItem => {
        if (!dbItem || !dbItem.title) return null;
        const key = normTitle(dbItem.title);
        const fallback = localMap.get(key);

        let relDate = dbItem.release_date || (fallback ? fallback.release_date : null);
        if (dbItem.title.includes("Doomsday") && (!relDate || relDate === "2026-05-01")) {
          relDate = "2026-12-18";
        }

        const safePoster = (dbItem.poster && String(dbItem.poster).startsWith("http"))
          ? dbItem.poster
          : (fallback && fallback.poster && fallback.poster !== "assets/placeholder-poster.svg" ? fallback.poster : dbItem.poster || null);

        const movieType = dbItem.type || (fallback ? fallback.type : (dbItem.phase === "xmen" ? "xmen" : dbItem.phase === "series" ? "series" : "movie"));

        return {
          id: dbItem.id,
          db_id: dbItem.id,
          title: dbItem.title,
          year: dbItem.year,
          phase: dbItem.phase,
          saga: dbItem.saga,
          status: dbItem.status || "released",
          release_date: relDate,
          runtime_minutes: dbItem.runtime_minutes || (fallback ? fallback.runtime_minutes : 120),
          priority: dbItem.priority || (fallback ? fallback.priority : "must-watch"),
          synopsis: dbItem.synopsis || (fallback ? fallback.synopsis : null),
          tmdb_query: dbItem.tmdb_query || (fallback ? fallback.tmdb_query : dbItem.title),
          spotlight: (dbItem.title.includes("Doomsday")) ? true : !!dbItem.spotlight,
          poster: safePoster,
          type: movieType,
          sort_order: typeof dbItem.sort_order === "number" ? dbItem.sort_order : (fallback ? fallback.sort_order : 100)
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    // Fallback: local roadmap when DB is empty or not yet connected
    return local.map(m => {
      if (m.title && m.title.includes("Doomsday") && (!m.release_date || m.release_date === "2026-05-01")) {
        return { ...m, release_date: "2026-12-18", spotlight: true };
      }
      return m;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async function upsertMovie(movie) {
    if (!movie || !movie.title) throw new Error("Title is required");
    const id = movie.id || movie.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let relDate = movie.release_date || `${movie.year || 2026}-12-18`;
    if (movie.title.includes("Doomsday") && (!relDate || relDate === "2026-05-01")) {
      relDate = "2026-12-18";
    }

    const payload = {
      id,
      title: movie.title.trim(),
      year: parseInt(movie.year, 10) || new Date().getFullYear(),
      phase: movie.phase || "phase6",
      saga: movie.saga || (movie.phase === "xmen" ? "Mutant Saga" : movie.phase === "series" ? "Disney+ Series" : (movie.phase === "phase6" || movie.phase === "phase5" || movie.phase === "phase4" ? "Multiverse Saga" : "Infinity Saga")),
      type: movie.type || (movie.phase === "xmen" ? "xmen" : movie.phase === "series" ? "series" : "movie"),
      status: movie.status || "upcoming",
      release_date: relDate,
      runtime_minutes: parseInt(movie.runtime_minutes, 10) || 120,
      priority: movie.priority || "must-watch",
      synopsis: movie.synopsis || null,
      tmdb_query: movie.tmdb_query || movie.title,
      spotlight: !!movie.spotlight,
      poster: movie.poster || null,
      sort_order: parseInt(movie.sort_order, 10) || 500
    };

    // Save locally
    setCustomMovieLocal(payload);

    // Save to Supabase if configured
    if (MI_SUPABASE.ready) {
      try {
        const { error } = await sb().from("movies").upsert(payload, { onConflict: "id" });
        if (error) {
          console.warn("[MarvelIndia] Supabase upsert error (saved locally):", error.message);
        }
      } catch (err) {
        console.warn("[MarvelIndia] Failed saving movie to Supabase:", err);
      }
    }
    return payload;
  }

  async function deleteMovie(id) {
    if (!id) return;
    deleteCustomMovieLocal(id);
    if (MI_SUPABASE.ready) {
      try {
        await sb().from("movies").delete().eq("id", id);
      } catch (err) {
        console.warn("[MarvelIndia] Failed deleting movie from Supabase:", err);
      }
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

    if (!isReady()) return null;
    try {
      const { data, error } = await withTimeout(sb().from("movies").select("*").eq("id", id).maybeSingle(), 4000);
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
    if (!isReady()) return local;
    try {
      const { data, error } = await withTimeout(sb().from("timeline_events").select("*").order("sort_order"), 4000);
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
    if (!isReady()) return localCharacters();
    try {
      const { data, error } = await withTimeout(sb().from("characters").select("*").order("sort_order"), 4000);
      if (error || !data || !data.length) return localCharacters();
      return data;
    } catch {
      return localCharacters();
    }
  }
  async function getCharacterById(id) {
    if (!isReady()) return localCharacters().find(c => String(c.id) === String(id)) || null;
    try {
      const { data, error } = await withTimeout(sb().from("characters").select("*").eq("id", id).single(), 4000);
      if (error || !data) return localCharacters().find(c => String(c.id) === String(id)) || null;
      return data;
    } catch {
      return localCharacters().find(c => String(c.id) === String(id)) || null;
    }
  }

  // ------------------------------------------------------------- wishlist
  async function getWishlist(userId) {
    if (!userId || !isReady()) return [];
    try {
      const { data, error } = await withTimeout(sb().from("wishlist").select("*").eq("user_id", userId).order("created_at", { ascending: false }), 4000);
      if (error) { console.error(error); return []; }
      return data || [];
    } catch {
      return [];
    }
  }
  async function isWishlisted(userId, itemId, itemType = "movie") {
    if (!userId || !isReady()) return false;
    try {
      const { data } = await withTimeout(sb().from("wishlist").select("id").eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType).maybeSingle(), 4000);
      return !!data;
    } catch {
      return false;
    }
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
    if (!isReady()) return items;

    const userIds = [...new Set(items.map(item => item[userIdField]).filter(Boolean))];
    if (!userIds.length) return items;

    try {
      const { data: profs, error } = await withTimeout(
        sb().from("profiles").select("id, username, avatar_url").in("id", userIds),
        4000
      );

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
    if (!isReady()) return [];
    try {
      const { data, error } = await withTimeout(
        sb().from("comments").select("id, body, created_at, user_id").eq("item_type", itemType).eq("item_id", itemId).order("created_at", { ascending: false }),
        4000
      );
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
  function getLocalWatched() {
    try {
      return JSON.parse(localStorage.getItem("mi_local_watched") || "[]");
    } catch {
      return [];
    }
  }

  function setLocalWatched(list) {
    try {
      localStorage.setItem("mi_local_watched", JSON.stringify(list));
    } catch {}
  }

  async function getWatchedIds(userId) {
    const local = getLocalWatched();
    if (!userId || !isReady()) return local;
    try {
      const { data, error } = await withTimeout(
        sb().from("watch_progress").select("movie_id").eq("user_id", userId).eq("watched", true),
        4000
      );
      if (error || !data) return local;
      const dbIds = data.map(r => r.movie_id);
      const merged = Array.from(new Set([...local, ...dbIds]));
      return merged;
    } catch {
      return local;
    }
  }

  async function toggleWatched(userId, movieId, nowWatched) {
    const local = getLocalWatched();
    let updated;
    if (nowWatched) {
      updated = Array.from(new Set([...local, movieId]));
    } else {
      updated = local.filter(id => id !== movieId);
    }
    setLocalWatched(updated);

    if (userId && MI_SUPABASE.ready) {
      try {
        if (nowWatched) {
          await sb().from("watch_progress").upsert({ user_id: userId, movie_id: movieId, watched: true, watched_at: new Date().toISOString() });
        } else {
          await sb().from("watch_progress").delete().eq("user_id", userId).eq("movie_id", movieId);
        }
      } catch (err) {
        // non-blocking sync error
      }
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
    try {
      const custom = JSON.parse(localStorage.getItem("mi_user_blog_posts") || "[]");
      if (Array.isArray(custom) && custom.length) {
        return [...custom, ...seed];
      }
    } catch (_) {}
    return seed;
  }

  async function getBlogPosts() {
    let customLocal = [];
    try {
      customLocal = JSON.parse(localStorage.getItem("mi_user_blog_posts") || "[]");
    } catch (_) {}

    if (!isReady()) return localBlogPosts();
    try {
      const { data, error } = await withTimeout(
        sb().from("blog_posts").select("id, title, slug, cover_image_url, body, tags, created_at, author_id").eq("published", true).order("created_at", { ascending: false }),
        4000
      );
      if (error || !data || !data.length) return localBlogPosts();
      const enriched = await enrichWithProfiles(data, "author_id");
      return [...customLocal, ...enriched];
    } catch {
      return localBlogPosts();
    }
  }

  async function getBlogPost(slug) {
    if (!isReady()) return localBlogPosts().find(p => p.slug === slug) || null;
    try {
      const localMatch = localBlogPosts().find(p => p.slug === slug);
      if (localMatch && localMatch.id && localMatch.id.startsWith("local-")) {
        return localMatch;
      }
      const { data, error } = await withTimeout(
        sb().from("blog_posts").select("id, title, slug, cover_image_url, body, tags, created_at, author_id").eq("slug", slug).maybeSingle(),
        4000
      );
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

  function safeSaveLocalBlogPosts(posts) {
    try {
      localStorage.setItem("mi_user_blog_posts", JSON.stringify(posts.slice(0, 30)));
    } catch (e) {
      console.warn("[MarvelIndia] LocalStorage full, trimming bulky images:", e);
      try {
        // If quota exceeded, sanitize posts by stripping large inline base64 data URLs
        const sanitized = posts.slice(0, 15).map(p => {
          let cleanBody = p.body;
          if (typeof cleanBody === "string" && cleanBody.length > 50000) {
            try {
              const parsed = JSON.parse(cleanBody);
              if (parsed.blocks) {
                parsed.blocks = parsed.blocks.map(b => {
                  if (b.type === "image" && b.url && b.url.startsWith("data:")) {
                    return { ...b, url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80" };
                  }
                  return b;
                });
                cleanBody = JSON.stringify(parsed);
              }
            } catch (_) {
              cleanBody = cleanBody.slice(0, 5000) + "...";
            }
          }
          let cleanCover = p.cover_image_url;
          if (cleanCover && cleanCover.startsWith("data:") && cleanCover.length > 5000) {
            cleanCover = "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80";
          }
          return { ...p, body: cleanBody, cover_image_url: cleanCover };
        });
        localStorage.setItem("mi_user_blog_posts", JSON.stringify(sanitized));
      } catch (err2) {
        console.warn("[MarvelIndia] Could not save to localStorage after sanitizing:", err2);
      }
    }
  }

  async function createBlogPost(userId, { title, body, tags, coverFile, coverUrl }) {
    if (!userId) {
      userId = "local-guest";
    }
    if (!title || !title.trim() || !body || !body.trim()) return { ok: false, error: "Title and content are required." };
    
    let finalCoverUrl = coverUrl || null;
    if (coverFile instanceof File) {
      try {
        const upload = await uploadBlogCover(userId, coverFile);
        if (upload && upload.ok && upload.url) {
          finalCoverUrl = upload.url;
        }
      } catch (err) {
        console.warn("[MarvelIndia] Cover upload fallback:", err);
      }
    } else if (typeof coverFile === "string" && coverFile.trim()) {
      finalCoverUrl = coverFile.trim();
    }
    if (!finalCoverUrl) {
      finalCoverUrl = "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80";
    }

    const slug = slugify(title);
    const tagArray = (tags || "").split(",").map(t => t.trim()).filter(Boolean);

    const newPost = {
      id: "local-" + Date.now(),
      title: title.trim(),
      slug,
      body: body.trim(),
      tags: tagArray,
      cover_image_url: finalCoverUrl,
      created_at: new Date().toISOString(),
      author_id: userId,
      profiles: { username: "Marvelite Writer", avatar_url: null }
    };

    // Save to local storage cache immediately
    try {
      const custom = JSON.parse(localStorage.getItem("mi_user_blog_posts") || "[]");
      custom.unshift(newPost);
      safeSaveLocalBlogPosts(custom);
    } catch (_) {}

    if (!isReady()) {
      return { ok: true, slug };
    }

    try {
      const { error } = await withTimeout(
        sb().from("blog_posts").insert({
          author_id: userId,
          title: title.trim(),
          slug,
          body: body.trim(),
          tags: tagArray,
          cover_image_url: finalCoverUrl
        }),
        3500
      );
      if (error) {
        console.warn("[MarvelIndia] Remote blog save skipped, local draft saved:", error.message);
      }
    } catch (err) {
      console.warn("[MarvelIndia] Remote blog save caught:", err);
    }
    return { ok: true, slug };
  }
  async function getBlogComments(postId) {
    if (!isReady()) return [];
    try {
      const { data, error } = await withTimeout(
        sb().from("blog_comments").select("id, body, created_at, user_id").eq("post_id", postId).order("created_at", { ascending: true }),
        4000
      );
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
        title: "Marvel Legends Iron Man Nano Gauntlet Electronic Fist",
        category: "Collectibles",
        price_label: "₹8,999",
        mrp_label: "₹11,999",
        discount_percent: "25% OFF",
        price_num: 8999,
        rating: 4.8,
        review_count: 1420,
        prime: true,
        tag: "Bestseller",
        blurb: "Articulated electronic fist featuring pulsating Infinity Stone light effects, authentic movie sound FX, and finger-snap lock.",
        image_url: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B083TBH775"
      },
      {
        id: "prod-2",
        title: "Marvel Studios: The MCU An Official Timeline (Hardcover)",
        category: "Books",
        price_label: "₹2,199",
        mrp_label: "₹2,999",
        discount_percent: "27% OFF",
        price_num: 2199,
        rating: 4.9,
        review_count: 2890,
        prime: true,
        tag: "Essential Lore",
        blurb: "The definitive guide written by Marvel Studios filmmakers, establishing the Sacred Timeline, incursions, and multiverse chronology.",
        image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/0744081679"
      },
      {
        id: "prod-3",
        title: "Captain America 24-Inch Shield 75th Anniversary Die-Cast Replica",
        category: "Replica",
        price_label: "₹13,499",
        mrp_label: "₹16,999",
        discount_percent: "20% OFF",
        price_num: 13499,
        rating: 4.9,
        review_count: 840,
        prime: true,
        tag: "Collector Replica",
        blurb: "Full 1:1 scale museum-grade metal replica shield with premium finish and adjustable genuine leather arm straps.",
        image_url: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B01B44MRDC"
      },
      {
        id: "prod-4",
        title: "Doctor Strange Eye of Agamotto Electronic Talisman & Stand",
        category: "Collectibles",
        price_label: "₹4,299",
        mrp_label: "₹5,499",
        discount_percent: "22% OFF",
        price_num: 4299,
        rating: 4.7,
        review_count: 670,
        prime: true,
        tag: "Time Stone Prop",
        blurb: "Features glowing green Time Stone opening mechanism, mystical runes, and collector pedestal display stand.",
        image_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B09H1TB3R8"
      },
      {
        id: "prod-5",
        title: "Marvel Legends Thor Mjolnir Electronic Hammer Replica",
        category: "Replica",
        price_label: "₹11,999",
        mrp_label: "₹14,999",
        discount_percent: "20% OFF",
        price_num: 11999,
        rating: 4.8,
        review_count: 980,
        prime: true,
        tag: "Voice-Activated",
        blurb: "1:1 scale hammer featuring voice-recognition rune lighting, thunder sound effects, and molded Asgardian strap.",
        image_url: "https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B06XW72Y65"
      },
      {
        id: "prod-6",
        title: "Spider-Man: No Way Home Integrated Suit 6-Inch Action Figure",
        category: "Collectibles",
        price_label: "₹1,899",
        mrp_label: "₹2,499",
        discount_percent: "24% OFF",
        price_num: 1899,
        rating: 4.7,
        review_count: 3120,
        prime: true,
        tag: "Popular",
        blurb: "Highly poseable figure with gold web armor accents, alternate Peter Parker head sculpt, and web accessories.",
        image_url: "https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B08TPSN37N"
      },
      {
        id: "prod-7",
        title: "Secret Wars & Infinity Gauntlet Marvel Graphic Novel Omnibus",
        category: "Books",
        price_label: "₹3,499",
        mrp_label: "₹4,999",
        discount_percent: "30% OFF",
        price_num: 3499,
        rating: 5.0,
        review_count: 1830,
        prime: true,
        tag: "Must-Read Comic",
        blurb: "Massive deluxe collector's edition containing the entire 1984 & 2015 multiverse collision storylines ahead of Avengers: Secret Wars.",
        image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/0785198863"
      },
      {
        id: "prod-8",
        title: "Marvel Avengers Heavyweight Oversized Graphic Streetwear Hoodie",
        category: "Wearables",
        price_label: "₹1,799",
        mrp_label: "₹2,999",
        discount_percent: "40% OFF",
        price_num: 1799,
        rating: 4.6,
        review_count: 1540,
        prime: true,
        tag: "Trending Apparel",
        blurb: "100% premium cotton French terry oversized hoodie with high-density Marvel Studios cinematic typography print.",
        image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/s?k=marvel+oversized+hoodie"
      },
      {
        id: "prod-9",
        title: "Deadpool Katanas Twin Sword Back-Scabbard Set",
        category: "Replica",
        price_label: "₹3,299",
        mrp_label: "₹4,499",
        discount_percent: "27% OFF",
        price_num: 3299,
        rating: 4.6,
        review_count: 420,
        prime: true,
        tag: "Cosplay Prop",
        blurb: "Twin stainless finish foam-core tactical katanas with adjustable harness straps, engineered for display and cosplay.",
        image_url: "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/s?k=deadpool+katanas"
      },
      {
        id: "prod-10",
        title: "Stark Industries Arc Reactor LED Desk Display & Night Lamp",
        category: "Desk & Gaming",
        price_label: "₹2,699",
        mrp_label: "₹3,799",
        discount_percent: "29% OFF",
        price_num: 2699,
        rating: 4.8,
        review_count: 2190,
        prime: true,
        tag: "Proof Tony Stark Has A Heart",
        blurb: "Crystal acrylic display case with vibration-sensor pulsing LED light modes and etched brass casing inscription.",
        image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/dp/B07R4TRK56"
      },
      {
        id: "prod-11",
        title: "Marvel Extended RGB XXL Gaming Desk Mat (900x400mm)",
        category: "Desk & Gaming",
        price_label: "₹1,299",
        mrp_label: "₹1,999",
        discount_percent: "35% OFF",
        price_num: 1299,
        rating: 4.7,
        review_count: 3670,
        prime: true,
        tag: "Gamer Setup",
        blurb: "Micro-textured waterproof cloth surface with 14 chroma RGB lighting modes featuring comic montage artwork.",
        image_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/s?k=marvel+rgb+mousepad"
      },
      {
        id: "prod-12",
        title: "Loki TVA Miss Minutes & TemPad Interactive Desk Figure",
        category: "Collectibles",
        price_label: "₹2,999",
        mrp_label: "₹3,999",
        discount_percent: "25% OFF",
        price_num: 2999,
        rating: 4.9,
        review_count: 760,
        prime: true,
        tag: "TVA Exclusive",
        blurb: "Glow-in-the-dark holographic Miss Minutes figurine with authentic TVA retro time-door case styling.",
        image_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=80",
        amazon_url: "https://www.amazon.in/s?k=loki+tva+merchandise"
      }
    ];
  }

  async function getAffiliateProducts() {
    if (!isReady()) return localAffiliateProducts();
    try {
      const { data, error } = await withTimeout(
        sb().from("affiliate_products").select("*").order("sort_order"),
        4000
      );
      if (error || !data || !data.length) return localAffiliateProducts();
      return data;
    } catch {
      return localAffiliateProducts();
    }
  }

  // ------------------------------------------------------------- storage uploads
  async function uploadAvatar(userId, file) {
    if (!isReady()) return { ok: false, error: "Offline mode" };
    try {
      const path = `${userId}/avatar.${file.name.split(".").pop()}`;
      const { error } = await withTimeout(
        sb().storage.from("avatars").upload(path, file, { upsert: true }),
        4000
      );
      if (error) return { ok: false, error: error.message };
      const { data } = sb().storage.from("avatars").getPublicUrl(path);
      await withTimeout(sb().from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId), 3000);
      return { ok: true, url: data.publicUrl };
    } catch (err) {
      return { ok: false, error: err.message || "Avatar upload timed out" };
    }
  }
  async function uploadBlogCover(userId, file) {
    if (!isReady()) return { ok: false, error: "Offline mode" };
    try {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await withTimeout(
        sb().storage.from("blog-covers").upload(path, file),
        4000
      );
      if (error) return { ok: false, error: error.message };
      const { data } = sb().storage.from("blog-covers").getPublicUrl(path);
      return { ok: true, url: data.publicUrl };
    } catch (err) {
      return { ok: false, error: err.message || "Cover upload timed out" };
    }
  }

  // ------------------------------------------------------------- profile
  async function getProfile(userId) {
    if (!userId || !isReady()) return null;
    try {
      const { data, error } = await withTimeout(
        sb().from("profiles").select("*").eq("id", userId).single(),
        4000
      );
      if (error) { console.error(error); return null; }
      return data;
    } catch {
      return null;
    }
  }
  async function setNotificationsEnabled(userId, enabled) {
    if (!userId) return { ok: false };
    const { error } = await sb().from("profiles").update({ notifications_enabled: enabled }).eq("id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return {
    getRoadmap, getMovie, getSpotlightMovie, upsertMovie, deleteMovie,
    getTimeline,
    getCharacters, getCharacterById,
    getWishlist, isWishlisted, toggleWishlist,
    getComments, addComment,
    getWatchedIds, toggleWatched,
    getBlogPosts, getBlogPost, createBlogPost, getBlogComments, addBlogComment,
    getAffiliateProducts,
    uploadAvatar, uploadBlogCover,
    getProfile, setNotificationsEnabled,
    localRoadmap, localTimeline, localBlogPosts, localAffiliateProducts
  };
})();
