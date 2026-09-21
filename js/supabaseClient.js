/**
 * One shared Supabase client for the whole app. Requires the supabase-js
 * CDN script (loaded in index.html before this file) and a filled-in
 * SUPABASE_URL / SUPABASE_ANON_KEY in js/config.js.
 */
const MI_SUPABASE = (() => {
  const cfg = window.MARVEL_INDIA_CONFIG;
  const configured = cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT-REF") && typeof window.supabase !== "undefined";
  if (!configured) {
    console.warn("[MarvelIndia] Supabase is not configured yet — fill in SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.");
    return { ready: false, client: null };
  }
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  return { ready: true, client };
})();
