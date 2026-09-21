/**
 * MARVEL INDIA — PRODUCTION CONFIG
 * ---------------------------------
 * Only public, non-secret values live here.
 * All external API keys (TMDB, OMDb, Marvel private, Watchmode)
 * are stored as Supabase Edge Function secrets and never reach the browser.
 */
window.MARVEL_INDIA_CONFIG = {
  // Supabase (required)
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-SUPABASE-ANON-PUBLIC-KEY",

  // Image bases (public)
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",
  TMDB_MARVEL_COMPANY_ID: 420,

  // Amazon Associates tracking tag (public by design)
  AMAZON_AFFILIATE_TAG: "your-affiliate-tag-21"
};
