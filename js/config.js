/**
 * MARVEL INDIA — CLIENT CONFIGURATION
 * -----------------------------------
 * Static public constants only.
 * SUPABASE_URL, SUPABASE_ANON_KEY, and API keys are loaded strictly from environment variables via /api/config.
 */
window.MARVEL_INDIA_CONFIG = Object.assign({
  TMDB_MARVEL_COMPANY_ID: 420,
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",
  AMAZON_AFFILIATE_TAG: "marvelindia09-21",
  CONTACT_EMAIL: "contact@marvelindia.in",
  LEGAL_EMAIL: "legal@marvelindia.in"
}, window.MARVEL_INDIA_CONFIG || {});

