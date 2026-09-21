/**
 * MARVEL INDIA — CONFIGURATION
 * ---------------------------------
 * Fill in every value below. See README.md § "What goes where" for exact
 * steps and screenshots-in-words for each one.
 */
window.MARVEL_INDIA_CONFIG = {
  // ---- Supabase (required — this is now the app's database, auth, storage
  // and realtime backend. Project Settings → API in your Supabase project.)
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-SUPABASE-ANON-PUBLIC-KEY",

  // ---- Movie/TV data APIs (all free — see README) ----
  TMDB_API_KEY: "",        // v3 auth key (32-char string) — themoviedb.org/settings/api
  OMDB_API_KEY: "",        // 8-char key — omdbapi.com/apikey.aspx
  WATCHMODE_API_KEY: "",   // long alphanumeric key — api.watchmode.com
  MARVEL_PUBLIC_KEY: "",   // developer.marvel.com public key
  MARVEL_PRIVATE_KEY: "",  // developer.marvel.com private key — see README's
                            // note on moving this server-side before a real launch

  TMDB_MARVEL_COMPANY_ID: 420,       // Marvel Studios on TMDB
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",

  // ---- Amazon Associates ----
  // Your Associates tracking ID, e.g. "marvelindia-21". Every affiliate
  // link rendered on the Shop page gets "?tag=<this>" appended automatically,
  // so you never have to edit product URLs individually.
  AMAZON_AFFILIATE_TAG: "your-affiliate-tag-21"
};
