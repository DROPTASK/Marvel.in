/**
 * Production API layer — all external calls go through Supabase Edge Functions.
 * Secrets never leave the server.
 */
const MI = window.MI_API = (() => {
  const cfg = window.MARVEL_INDIA_CONFIG;

  function edgeBase() {
    return `${cfg.SUPABASE_URL}/functions/v1`;
  }

  async function edgeFetch(fnName, params = {}) {
    if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
      console.warn("[MarvelIndia] Supabase URL not set");
      return null;
    }
    const url = new URL(`${edgeBase()}/${fnName}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, v);
    });
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
          apikey: cfg.SUPABASE_ANON_KEY
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("[MarvelIndia] edge fetch failed:", fnName, err.message);
      return null;
    }
  }

  // ---------------- TMDB (via edge) ------------------------------------
  const tmdb = {
    ready: () => true, // keys live on server

    async discoverMarvel(page = 1) {
      return edgeFetch("tmdb-api", {
        path: "/discover/movie",
        with_companies: cfg.TMDB_MARVEL_COMPANY_ID,
        sort_by: "primary_release_date.desc",
        page
      });
    },

    async searchMovie(query) {
      if (!query) return null;
      return edgeFetch("tmdb-api", { path: "/search/movie", query });
    },

    async movieDetails(id) {
      return edgeFetch("tmdb-api", { path: `/movie/${id}`, append_to_response: "credits,videos" });
    },

    async findByQuery(query) {
      const data = await this.searchMovie(query);
      if (!data?.results?.length) return null;
      return data.results[0];
    },

    posterUrl(path, size = "w500") {
      if (!path) return null;
      return `https://image.tmdb.org/t/p/${size}${path}`;
    },

    backdropUrl(path) {
      if (!path) return null;
      return cfg.TMDB_BACKDROP_BASE + path;
    }
  };

  // ---------------- OMDb (via edge) ------------------------------------
  const omdb = {
    ready: () => true,

    async byImdb(imdbId) {
      if (!imdbId) return null;
      return edgeFetch("omdb-api", { i: imdbId });
    },

    async byTitle(title, year) {
      const params = { t: title };
      if (year) params.y = year;
      return edgeFetch("omdb-api", params);
    }
  };

  // ---------------- Watchmode (via edge) --------------------------------
  const watchmode = {
    ready: () => true,

    async search(title) {
      return edgeFetch("watchmode-api", {
        path: "/search/",
        search_field: "name",
        search_value: title
      });
    },

    async sources(titleId) {
      return edgeFetch("watchmode-api", {
        path: `/title/${titleId}/sources/`
      });
    },

    async whereToWatch(title) {
      const search = await this.search(title);
      if (!search?.title_results?.length) return [];
      const id = search.title_results[0].id;
      const sources = await this.sources(id);
      if (!Array.isArray(sources)) return [];
      // Prefer India region when present
      return sources.filter(s => !s.region || s.region === "IN" || s.region === "US");
    }
  };

  // ---------------- Marvel Comics API (via edge) -----------------------
  const marvel = {
    ready: () => true,

    async searchCharacter(name) {
      return edgeFetch("marvel-api", { name });
    },

    async characterById(id) {
      return edgeFetch("marvel-api", { characterId: id });
    },

    thumbnailUrl(thumb) {
      if (!thumb?.path || !thumb?.extension) return null;
      return `${thumb.path}/standard_fantastic.${thumb.extension}`.replace("http://", "https://");
    }
  };

  // Convenience helpers used by app.js
  async function enrichMovie(movie) {
    if (!movie?.tmdb_query) return movie;
    const tmdbHit = await tmdb.findByQuery(movie.tmdb_query);
    if (!tmdbHit) return movie;
    return {
      ...movie,
      poster: tmdb.posterUrl(tmdbHit.poster_path),
      backdrop: tmdb.backdropUrl(tmdbHit.backdrop_path),
      tmdb_id: tmdbHit.id,
      vote_average: tmdbHit.vote_average,
      overview: movie.synopsis || tmdbHit.overview
    };
  }

  async function getRatings(imdbId, title, year) {
    const data = imdbId ? await omdb.byImdb(imdbId) : await omdb.byTitle(title, year);
    if (!data || data.Response === "False") return null;
    return {
      imdb: data.imdbRating,
      rottenTomatoes: data.Ratings?.find(r => r.Source === "Rotten Tomatoes")?.Value,
      metacritic: data.Metascore
    };
  }

  return { tmdb, omdb, watchmode, marvel, enrichMovie, getRatings };
})();
