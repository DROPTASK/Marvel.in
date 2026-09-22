/**
 * MARVEL INDIA — CLIENT CONFIGURATION
 * -----------------------------------
 * Configuration is dynamically supplied via server environment variables.
 * Do not save API keys in this file.
 */
window.MARVEL_INDIA_CONFIG = Object.assign({
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  TMDB_API_KEY: "",
  OMDB_API_KEY: "",
  WATCHMODE_API_KEY: "",
  TMDB_MARVEL_COMPANY_ID: 420,
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",
  AMAZON_AFFILIATE_TAG: "marvelindia09-21"
}, window.MARVEL_INDIA_CONFIG || {});
