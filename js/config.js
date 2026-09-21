/**
 * MARVEL INDIA — PRODUCTION CONFIG
 * ---------------------------------
 * Only public, non-secret values live here.
 * All external API keys (TMDB, OMDb, Marvel private, Watchmode)
 * are stored as Supabase Edge Function secrets and never reach the browser.
 */
window.MARVEL_INDIA_CONFIG = {
  // Supabase (required)
  SUPABASE_URL: "https://oospjmsuwrxvuuzfxwqu.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vc3BqbXN1d3J4dnV1emZ4d3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODE5NDIsImV4cCI6MjEwNTU1Nzk0Mn0.ziz8t0vcFLKRiyYSD6Vk4eTtMUvDh3qYXskZy1-XLIo",

  // Image bases (public)
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",
  TMDB_MARVEL_COMPANY_ID: 420,

  // Amazon Associates tracking tag (public by design)
  AMAZON_AFFILIATE_TAG: "marvelindia09-21"
};
