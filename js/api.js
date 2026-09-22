/**
 * Thin fetch wrappers around every external API this app touches.
 * Every function fails soft: on any error/missing key it returns null or []
 * so the UI degrades to a small "add a key" notice instead of breaking the
 * page. All primary content now comes from Supabase (js/db.js) — these
 * wrappers only enrich it with live posters, ratings and streaming links.
 */
const MI = window.MI_API = (() => {
  const getCfg = () => window.MARVEL_INDIA_CONFIG || {};

  async function safeJson(url, timeoutMs = 5000) {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      const res = await fetch(url, controller ? { signal: controller.signal } : {});
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("[MarvelIndia] fetch failed:", url, err.message);
      return null;
    }
  }

  // ---------------- TMDB ----------------------------------------------
  const tmdb = {
    ready: () => !!getCfg().TMDB_API_KEY,

    // Movies + credits produced by Marvel Studios, newest first
    async discoverMarvel(page = 1) {
      if (!this.ready()) return null;
      const cfg = getCfg();
      const url = `https://api.themoviedb.org/3/discover/movie?api_key=${cfg.TMDB_API_KEY}` +
        `&with_companies=${cfg.TMDB_MARVEL_COMPANY_ID}&sort_by=primary_release_date.desc&page=${page}`;
      return safeJson(url);
    },

    async search(query) {
      if (!this.ready() || !query) return null;
      const cfg = getCfg();
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${cfg.TMDB_API_KEY}` +
        `&query=${encodeURIComponent(query)}&include_adult=false`;
      return safeJson(url);
    },

    async movieDetails(id) {
      if (!this.ready()) return null;
      const cfg = getCfg();
      const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${cfg.TMDB_API_KEY}` +
        `&append_to_response=credits,videos,external_ids,watch/providers`;
      return safeJson(url);
    },

    async tvDetails(id) {
      if (!this.ready()) return null;
      const cfg = getCfg();
      const url = `https://api.themoviedb.org/3/tv/${id}?api_key=${cfg.TMDB_API_KEY}` +
        `&append_to_response=credits,videos,external_ids,watch/providers`;
      return safeJson(url);
    },

    async mediaDetails(id, mediaType = "movie") {
      if (!this.ready() || !id) return null;
      const isTv = mediaType === "tv" || mediaType === "series";
      let data = null;

      if (isTv) {
        data = await this.tvDetails(id);
      } else if (mediaType === "movie") {
        data = await this.movieDetails(id);
      } else {
        // Unknown: try movieDetails first, check if valid or if TV has higher popularity/match
        const [mov, tv] = await Promise.all([
          this.movieDetails(id).catch(() => null),
          this.tvDetails(id).catch(() => null)
        ]);
        if (mov && tv) {
          // If TV has dramatically higher popularity / vote count, it is likely the intended show
          data = (tv.vote_count || 0) > (mov.vote_count || 0) ? tv : mov;
        } else {
          data = mov || tv || null;
        }
      }

      if (!data) return null;
      return {
        ...data,
        title: data.title || data.name || "Untitled",
        release_date: data.release_date || data.first_air_date || null,
        runtime: data.runtime || (data.episode_run_time && data.episode_run_time[0]) || null,
        media_type: (data.name && !data.title) ? "tv" : (data.title && !data.name ? "movie" : (isTv ? "tv" : "movie"))
      };
    },

    // Accurate media lookup with title verification, type priority, and year handling
    async findMedia(title, expectedType = null, year = null) {
      if (!this.ready() || !title) return null;
      let cleanQuery = String(title).trim();
      let targetYear = year ? String(year).trim() : null;

      // Extract trailing 4-digit year from query if present
      const ym = cleanQuery.match(/^(.*?)\s+(\d{4})$/);
      if (ym) {
        cleanQuery = ym[1].trim();
        if (!targetYear) targetYear = ym[2];
      }

      const isTv = expectedType === "tv" || expectedType === "series";

      // 1. Try search/multi
      const data = await this.search(cleanQuery);
      let results = (data && data.results) ? data.results.filter(r => r.media_type !== "person") : [];

      if (expectedType) {
        results.sort((a, b) => {
          const aMatch = isTv ? a.media_type === "tv" : a.media_type === "movie";
          const bMatch = isTv ? b.media_type === "tv" : b.media_type === "movie";
          return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
        });
      }

      // 2. If no matching results, try specific search/movie or search/tv
      if (!results.length && expectedType) {
        const ep = isTv ? "tv" : "movie";
        const yrParam = isTv
          ? (targetYear ? `&first_air_date_year=${targetYear}` : "")
          : (targetYear ? `&primary_release_year=${targetYear}` : "");
        const cfg = getCfg();
        const specificUrl = `https://api.themoviedb.org/3/search/${ep}?api_key=${cfg.TMDB_API_KEY}` +
          `&query=${encodeURIComponent(cleanQuery)}${yrParam}&include_adult=false`;
        const specData = await safeJson(specificUrl);
        if (specData && specData.results && specData.results.length) {
          results = specData.results.map(r => ({ ...r, media_type: ep }));
        }
      }

      if (!results.length) return null;

      const norm = str => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const titleNorm = norm(title);
      const cleanNorm = norm(cleanQuery);

      // Pass 1: Exact title match
      for (const r of results) {
        const rNorm = norm(r.title || r.name);
        if (rNorm === cleanNorm || rNorm === titleNorm) {
          if (!expectedType || (isTv ? r.media_type === "tv" : r.media_type === "movie")) {
            return r;
          }
        }
      }

      // Pass 2: Exact title match regardless of expected type
      for (const r of results) {
        const rNorm = norm(r.title || r.name);
        if (rNorm === cleanNorm || rNorm === titleNorm) return r;
      }

      // Pass 3: Contains match with matching media type
      for (const r of results) {
        if (expectedType) {
          const mMatch = isTv ? r.media_type === "tv" : r.media_type === "movie";
          if (!mMatch) continue;
        }
        const rNorm = norm(r.title || r.name);
        if (rNorm.includes(cleanNorm) || cleanNorm.includes(rNorm)) return r;
      }

      // Pass 4: Starts-with match with matching media type
      for (const r of results) {
        if (expectedType) {
          const mMatch = isTv ? r.media_type === "tv" : r.media_type === "movie";
          if (!mMatch) continue;
        }
        const rNorm = norm(r.title || r.name);
        if (cleanNorm.length >= 4 && rNorm.slice(0, 4) === cleanNorm.slice(0, 4)) return r;
      }

      return null;
    },

    // Best-effort lookup used to enrich curated entries
    async findByTitle(title, expectedType = null, year = null) {
      return this.findMedia(title, expectedType, year);
    },

    posterUrl(path) {
      if (!path) return null;
      const cfg = getCfg();
      const base = (cfg.TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p/w500").replace("http://", "https://");
      const p = path.startsWith("http") ? path.replace("http://", "https://") : base + path;
      return p;
    },
    backdropUrl(path) {
      if (!path) return null;
      const cfg = getCfg();
      const base = (cfg.TMDB_BACKDROP_BASE || "https://image.tmdb.org/t/p/original").replace("http://", "https://");
      return path.startsWith("http") ? path.replace("http://", "https://") : base + path;
    }
  };

  // ---------------- OMDb ------------------------------------------------
  const omdb = {
    ready: () => !!getCfg().OMDB_API_KEY,
    // Accepts an IMDb id (preferred, comes from TMDB external_ids) or a title
    async byImdbId(imdbId) {
      if (!this.ready() || !imdbId) return null;
      const cfg = getCfg();
      const url = `https://www.omdbapi.com/?apikey=${cfg.OMDB_API_KEY}&i=${imdbId}&tomatoes=true`;
      return safeJson(url);
    },
    async byTitle(title, year) {
      if (!this.ready() || !title) return null;
      const cfg = getCfg();
      const url = `https://www.omdbapi.com/?apikey=${cfg.OMDB_API_KEY}&t=${encodeURIComponent(title)}` +
        (year ? `&y=${year}` : "");
      return safeJson(url);
    }
  };

  // ---------------- TVmaze (no key required) -----------------------------
  const tvmaze = {
    async search(query) {
      if (!query) return null;
      const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
      return safeJson(url);
    },
    async showById(id) {
      if (!id) return null;
      const url = `https://api.tvmaze.com/shows/${id}?embed[]=cast&embed[]=episodes`;
      return safeJson(url);
    }
  };

  // ---------------- Watchmode ("where to watch") -------------------------
  const watchmode = {
    ready: () => !!getCfg().WATCHMODE_API_KEY,
    async searchByImdb(imdbId) {
      if (!this.ready() || !imdbId) return null;
      const cfg = getCfg();
      const url = `https://api.watchmode.com/v1/search/?apiKey=${cfg.WATCHMODE_API_KEY}` +
        `&search_field=imdb_id&search_value=${imdbId}`;
      return safeJson(url);
    },
    async sources(titleId) {
      if (!this.ready() || !titleId) return null;
      const cfg = getCfg();
      const url = `https://api.watchmode.com/v1/title/${titleId}/sources/?apiKey=${cfg.WATCHMODE_API_KEY}` +
        `&regions=IN,US`;
      return safeJson(url);
    }
  };

  return { tmdb, omdb, tvmaze, watchmode };
})();
