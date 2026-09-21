/**
 * Thin fetch wrappers around every external API this app touches.
 * Every function fails soft: on any error/missing key it returns null or []
 * so the UI degrades to a small "add a key" notice instead of breaking the
 * page. All primary content now comes from Supabase (js/db.js) — these
 * wrappers only enrich it with live posters, ratings and streaming links.
 */
const MI = window.MI_API = (() => {
  const cfg = window.MARVEL_INDIA_CONFIG;

  async function safeJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("[MarvelIndia] fetch failed:", url, err.message);
      return null;
    }
  }

  // ---------------- TMDB ----------------------------------------------
  const tmdb = {
    ready: () => !!cfg.TMDB_API_KEY,

    // Movies + credits produced by Marvel Studios, newest first
    async discoverMarvel(page = 1) {
      if (!this.ready()) return null;
      const url = `https://api.themoviedb.org/3/discover/movie?api_key=${cfg.TMDB_API_KEY}` +
        `&with_companies=${cfg.TMDB_MARVEL_COMPANY_ID}&sort_by=primary_release_date.desc&page=${page}`;
      return safeJson(url);
    },

    async search(query) {
      if (!this.ready() || !query) return null;
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${cfg.TMDB_API_KEY}` +
        `&query=${encodeURIComponent(query)}&include_adult=false`;
      return safeJson(url);
    },

    async movieDetails(id) {
      if (!this.ready()) return null;
      const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${cfg.TMDB_API_KEY}` +
        `&append_to_response=credits,videos,external_ids,watch/providers`;
      return safeJson(url);
    },

    // best-effort single-result lookup used to enrich curated roadmap/timeline entries
    async findByTitle(title) {
      const data = await this.search(title);
      if (!data || !data.results || !data.results.length) return null;
      return data.results.find(r => r.media_type !== "person") || null;
    },

    posterUrl(path) {
      if (!path) return null;
      const base = (cfg.TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p/w500").replace("http://", "https://");
      const p = path.startsWith("http") ? path.replace("http://", "https://") : base + path;
      return p;
    },
    backdropUrl(path) {
      if (!path) return null;
      const base = (cfg.TMDB_BACKDROP_BASE || "https://image.tmdb.org/t/p/original").replace("http://", "https://");
      return path.startsWith("http") ? path.replace("http://", "https://") : base + path;
    }
  };

  // ---------------- OMDb ------------------------------------------------
  const omdb = {
    ready: () => !!cfg.OMDB_API_KEY,
    // Accepts an IMDb id (preferred, comes from TMDB external_ids) or a title
    async byImdbId(imdbId) {
      if (!this.ready() || !imdbId) return null;
      const url = `https://www.omdbapi.com/?apikey=${cfg.OMDB_API_KEY}&i=${imdbId}&tomatoes=true`;
      return safeJson(url);
    },
    async byTitle(title, year) {
      if (!this.ready() || !title) return null;
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
    ready: () => !!cfg.WATCHMODE_API_KEY,
    async searchByImdb(imdbId) {
      if (!this.ready() || !imdbId) return null;
      const url = `https://api.watchmode.com/v1/search/?apiKey=${cfg.WATCHMODE_API_KEY}` +
        `&search_field=imdb_id&search_value=${imdbId}`;
      return safeJson(url);
    },
    async sources(titleId) {
      if (!this.ready() || !titleId) return null;
      const url = `https://api.watchmode.com/v1/title/${titleId}/sources/?apiKey=${cfg.WATCHMODE_API_KEY}` +
        `&regions=IN,US`;
      return safeJson(url);
    }
  };

  // ---------------- Marvel Comics API (characters) ------------------------
  // Requires MD5(ts + privateKey + publicKey). We compute it client-side with
  // a tiny built-in md5 implementation (see md5.js) purely for demo purposes —
  // for production, proxy this through a server so the private key never
  // reaches the browser.
  const marvel = {
    ready: () => !!(cfg.MARVEL_PUBLIC_KEY && cfg.MARVEL_PRIVATE_KEY && window.md5),
    authParams() {
      const ts = Date.now().toString();
      const hash = window.md5(ts + cfg.MARVEL_PRIVATE_KEY + cfg.MARVEL_PUBLIC_KEY);
      return `ts=${ts}&apikey=${cfg.MARVEL_PUBLIC_KEY}&hash=${hash}`;
    },
    async searchCharacter(name) {
      if (!this.ready() || !name) return null;
      const url = `https://gateway.marvel.com/v1/public/characters?nameStartsWith=${encodeURIComponent(name)}&${this.authParams()}`;
      return safeJson(url);
    },
    async characterComics(characterId) {
      if (!this.ready() || !characterId) return null;
      const url = `https://gateway.marvel.com/v1/public/characters/${characterId}/comics?limit=12&${this.authParams()}`;
      return safeJson(url);
    }
  };

  return { tmdb, omdb, tvmaze, watchmode, marvel };
})();
