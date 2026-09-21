# Marvel India

A Marvel-focused movie & character hub: search, ratings, "where to watch",
an in-universe timeline, a phase-by-phase movie roadmap, a character
database, and signup-gated wishlist/comments. Pure HTML/CSS/JS — no build
step. Open `index.html` in a browser, or serve the folder, and it runs.

## 1. Get your free API keys (5–10 minutes total)

Open `js/config.js` and fill in the keys below.

| Service | What it powers | Where to get a key | Free tier |
|---|---|---|---|
| **TMDB** | Home grid, search, movie details, cast, posters, "where to watch" (India region) | https://www.themoviedb.org/settings/api | Free, instant, unlimited for this use |
| **OMDb** | IMDb / Rotten Tomatoes ratings on the movie page | https://www.omdbapi.com/apikey.aspx | Free, 1,000 requests/day |
| **TVmaze** | TV/series lookups | No key needed — already wired in `js/api.js` | Free |
| **Watchmode** | Extra streaming-availability sources beyond TMDB's | https://api.watchmode.com/ | Free, 1,000 requests/month |
| **Marvel Comics API** | Comic appearances on the Character page | https://developer.marvel.com/ | Free, needs a public **and** private key |

Without any keys, the app still runs — every screen falls back to the
curated sample data in `js/data.js` so you can see the full UI immediately.

```js
window.MARVEL_INDIA_CONFIG = {
  TMDB_API_KEY: "your-tmdb-key",
  OMDB_API_KEY: "your-omdb-key",
  WATCHMODE_API_KEY: "your-watchmode-key",
  MARVEL_PUBLIC_KEY: "your-marvel-public-key",
  MARVEL_PRIVATE_KEY: "your-marvel-private-key",
  ...
};
```

## 2. Run it

Any static file server works, e.g.:

```bash
cd marvelindia
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly by double-clicking also works in most
browsers, though some browsers block `fetch()` on `file://` pages — a local
server avoids that.

## 3. What's included

- **Home** — a Doomsday Clock countdown to *Avengers: Doomsday*'s release,
  a live grid of Marvel Studios titles pulled from TMDB (falls back to a
  curated list), and quick links to Timeline / Characters / Roadmap.
- **Search** — multi-search across movies and shows via TMDB.
- **Movie detail** — synopsis, genres, runtime, TMDB/IMDb/Rotten Tomatoes
  ratings, full cast with character names, "where to watch" (TMDB + Watchmode
  providers for India/US), a signup-gated wishlist button, and a comments
  thread (persisted per-browser).
- **Timeline** — the MCU told in-universe chronological order, not release
  order, with a one-paragraph story beat per film.
- **Roadmap** — every MCU film grouped by Phase/Saga as a checklist you can
  tick off as watched, upcoming titles clearly tagged.
- **Characters** — a curated database of major heroes/villains (actor,
  aliases, powers, affiliation, first appearance), each with a detail page
  that also pulls real comic-issue appearances from the Marvel Comics API
  when configured.
- **Accounts** — signup/login, a personal wishlist, and comments, all
  gated behind creating an account.

## 4. Important limitations (read before treating this as production)

- **Accounts, wishlist, and comments are stored in `localStorage`.** They
  live only in one browser on one device, are visible to anyone with
  dev-tools access to that browser, and are **not** a real authentication
  system. For a real launch, replace `js/auth.js` with calls to a real
  backend (Firebase Auth/Supabase/your own API + database) so accounts and
  comments are shared across devices and properly secured.
- **The Marvel Comics API private key must not ship to real users' browsers.**
  This demo computes the required request signature client-side for
  simplicity (see `js/md5.js` and `js/api.js`). Before you deploy this
  publicly, move Marvel API calls behind a small backend/serverless
  function so the private key stays server-side.
- **TMDB/OMDb/Watchmode keys in `js/config.js` are also visible to anyone
  who views your page source once deployed.** TMDB and OMDb keys are
  designed to be used this way (rate-limited per key, not secret-sensitive),
  but if you exceed free-tier limits or want to hide usage, proxy those
  calls through your own backend too.
- **"Where to watch" coverage depends on the region and on TMDB/Watchmode's
  own licensing data** — it will be incomplete for very new or India-only
  releases.
- **Marvel API character matching** in `js/data.js`/`js/app.js` does a
  best-effort name search against the Comics API; it isn't a guaranteed
  1:1 match for every alias.

## 5. File structure

```
marvelindia/
├── index.html
├── css/style.css
├── js/
│   ├── config.js   — your API keys
│   ├── data.js     — curated timeline / roadmap / character data
│   ├── md5.js       — MD5 for Marvel API request signing
│   ├── api.js       — fetch wrappers for TMDB/OMDb/TVmaze/Watchmode/Marvel
│   ├── auth.js      — localStorage-based signup/login/wishlist/comments
│   └── app.js       — router + view rendering
├── assets/          — placeholder poster/avatar SVGs
└── README.md
```
# Marvel.in
