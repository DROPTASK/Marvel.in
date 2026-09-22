/**
 * One shared Supabase client for the whole app. Requires the supabase-js
 * CDN script (loaded in index.html before this file) and SUPABASE_URL /
 * SUPABASE_ANON_KEY strictly from Vercel / server environment variables.
 */
const MI_SUPABASE = (() => {
  let cachedClient = null;
  let configFetchPromise = null;

  async function fetchEnvConfig() {
    if (window.MARVEL_INDIA_CONFIG?.SUPABASE_URL && window.MARVEL_INDIA_CONFIG?.SUPABASE_ANON_KEY) {
      return window.MARVEL_INDIA_CONFIG;
    }
    if (!configFetchPromise) {
      configFetchPromise = fetch("/api/config")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            window.MARVEL_INDIA_CONFIG = Object.assign(window.MARVEL_INDIA_CONFIG || {}, data);
            if (window.supabase && data.SUPABASE_URL && data.SUPABASE_ANON_KEY) {
              cachedClient = window.supabase.createClient(data.SUPABASE_URL, data.SUPABASE_ANON_KEY);
            }
          }
          return window.MARVEL_INDIA_CONFIG;
        })
        .catch(err => {
          console.warn("[MarvelIndia] Could not fetch /api/config:", err);
          return null;
        });
    }
    return configFetchPromise;
  }

  // Pre-fetch in background
  if (typeof window !== "undefined" && (!window.MARVEL_INDIA_CONFIG?.SUPABASE_URL || !window.MARVEL_INDIA_CONFIG?.SUPABASE_ANON_KEY)) {
    fetchEnvConfig();
  }

  function resolveClient() {
    if (cachedClient) return cachedClient;
    const cfg = window.MARVEL_INDIA_CONFIG;
    const configured = cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_URL.includes("YOUR-PROJECT-REF") && typeof window.supabase !== "undefined";
    if (!configured) {
      return null;
    }
    try {
      cachedClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      return cachedClient;
    } catch (err) {
      console.warn("[MarvelIndia] Failed to initialize Supabase client:", err);
      return null;
    }
  }

  return {
    get ready() {
      return resolveClient() !== null;
    },
    get client() {
      return resolveClient();
    },
    async ensureReady() {
      if (resolveClient()) return cachedClient;
      await fetchEnvConfig();
      return resolveClient();
    }
  };
})();
