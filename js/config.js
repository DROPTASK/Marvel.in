/**
 * MARVEL INDIA — API CONFIGURATION
 * ---------------------------------
 * Every key below is free to obtain. Sign up, paste your key in, save the file.
 * Nothing in this app will work against live data until these are filled in —
 * until then the app runs on the bundled sample data (see js/data.js).
 *
 * TMDB        -> https://www.themoviedb.org/settings/api            (free, instant)
 * OMDb        -> https://www.omdbapi.com/apikey.aspx                (free tier: 1,000 req/day)
 * TVmaze      -> https://www.tvmaze.com/api                         (no key needed at all)
 * Watchmode   -> https://api.watchmode.com/                         (free tier: 1,000 req/month)
 * Marvel API  -> https://developer.marvel.com/                      (free, needs public+private key)
 */
window.MARVEL_INDIA_CONFIG = {
  TMDB_API_KEY: "",        // v3 auth key (32-char string)
  OMDB_API_KEY: "",        // 8-char key
  WATCHMODE_API_KEY: "",   // long alphanumeric key
  MARVEL_PUBLIC_KEY: "",   // developer.marvel.com public key
  MARVEL_PRIVATE_KEY: "",  // developer.marvel.com private key — used only to compute an
                            // md5 hash in-browser; for a real deployment, move Marvel API
                            // calls to a tiny backend/proxy so the private key is never
                            // shipped to the client.
  TMDB_MARVEL_COMPANY_ID: 420,       // Marvel Studios on TMDB
  TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original"
};
