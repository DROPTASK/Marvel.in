/**
 * One shared Supabase client for the whole app. Requires the supabase-js
 * CDN script (loaded in index.html before this file) and SUPABASE_URL /
 * SUPABASE_ANON_KEY from Vercel / server environment variables.
 */
const MI_SUPABASE = (() => {
  let cachedClient = null;

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
    }
  };
})();
