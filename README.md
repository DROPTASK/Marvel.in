# Marvel India

A Marvel-focused hub, now fully backed by **Supabase** (auth, Postgres
database, storage, realtime) instead of localStorage or bundled static
data: search, ratings, "where to watch," an in-universe timeline, a
Doomsday watch-plan roadmap, a character database, a community **blog**
with notifications, and an **Amazon affiliate shop**. Still no build step —
open `index.html` (via a local server) and it runs.

---

## 1. What goes where (fill this in before anything works)

Every value lives in **`js/config.js`**. Nothing else needs editing to get
the app running.

```js
window.MARVEL_INDIA_CONFIG = {
  SUPABASE_URL: "...",          // ← from your Supabase project
  SUPABASE_ANON_KEY: "...",     // ← from your Supabase project
  TMDB_API_KEY: "...",
  OMDB_API_KEY: "...",
  WATCHMODE_API_KEY: "...",
  MARVEL_PUBLIC_KEY: "...",
  MARVEL_PRIVATE_KEY: "...",
  AMAZON_AFFILIATE_TAG: "..."
};
```

| Key | Where to get it | Free tier | Powers |
|---|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Create a project at https://supabase.com → **Project Settings → API** → copy "Project URL" and "anon public" key | Free tier is plenty for this app | Accounts, the whole database, file storage, realtime notifications |
| `TMDB_API_KEY` | https://www.themoviedb.org/settings/api | Free, instant | Posters, synopses, cast, ratings, search, "where to watch" (India region) |
| `OMDB_API_KEY` | https://www.omdbapi.com/apikey.aspx | Free, 1,000 req/day | IMDb / Rotten Tomatoes scores on the movie page |
| `WATCHMODE_API_KEY` | https://api.watchmode.com/ | Free, 1,000 req/month | Extra streaming-availability sources beyond TMDB's |
| `MARVEL_PUBLIC_KEY` / `MARVEL_PRIVATE_KEY` | https://developer.marvel.com/ (Sign up → "Get a Key") | Free | Real comic-issue appearances on each character page |
| `AMAZON_AFFILIATE_TAG` | https://affiliate-program.amazon.in (or amazon.com) → your Associates dashboard | Free to join | Appended to every product link on the Shop page |

`TVmaze` needs **no key** — already wired up in `js/api.js`.

Without the movie/character API keys, those specific enrichments (posters,
ratings, comic issues) just show a small "add a key" notice — the rest of
the app still works. **Supabase is not optional** — without it, every page
shows a "Supabase isn't connected yet" notice, because there is no more
bundled static data to fall back to.

---

## 2. Set up Supabase (one-time, ~10 minutes)

1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run these three files from the `supabase/`
   folder, **in order**, each as its own query:
   - `01_schema.sql` — creates every table (`movies`, `timeline_events`,
     `characters`, `profiles`, `wishlist`, `comments`, `watch_progress`,
     `blog_posts`, `blog_comments`, `affiliate_products`) plus Row Level
     Security policies and the trigger that creates a `profiles` row
     whenever someone signs up.
   - `02_seed.sql` — populates `movies`, `timeline_events`, `characters`,
     and five starter `affiliate_products` rows. **Edit the `amazon_url`
     values here (or later in Table Editor) to your real product links** —
     your affiliate tag is appended automatically at render time.
   - `03_storage.sql` — creates the `avatars` and `blog-covers` storage
     buckets with public-read / owner-write policies.
3. Go to **Project Settings → API**, copy the **Project URL** and **anon
   public** key into `js/config.js`.
4. (Optional but recommended) In **Authentication → Providers**, turn off
   "Confirm email" while developing locally so signup logs you in
   immediately — turn it back on before a real launch.

Everything the app shows — movies, timeline, characters, blog posts, shop
products — is now a row in your Supabase Postgres database. To add/edit/
remove content, use Supabase's **Table Editor**, no code changes needed.

---

## 3. Run it

```bash
cd marvelindia
python3 -m http.server 8080
# open http://localhost:8080
```

A local server is required now (not just recommended) — `fetch()` calls to
Supabase are blocked on `file://` pages by most browsers.

---

## 4. What's new in this version

- **Supabase auth** replaces the old localStorage demo login. Real
  accounts (email + password), a `profiles` row created automatically per
  user, and Row Level Security so people can only edit their own wishlist,
  comments, watch progress, and blog posts.
- **Nothing loads from static JS anymore.** The old `js/data.js` is gone;
  movies, timeline events, characters, blog posts, and affiliate products
  are all fetched live from Supabase (`js/db.js`). External APIs (TMDB/
  OMDb/TVmaze/Watchmode/Marvel) are used only to *enrich* those DB rows
  with live posters, ratings, and streaming links.
- **Mobile gets its own layout**, not just a squeezed desktop one: a fixed
  bottom tab bar (Home/Search/Roadmap/Blog/Shop) replaces the top nav under
  720px width, cards drop to a tighter grid, and panels get lighter shadows.
- **Scroll-to-top on every navigation** — `route()` now calls
  `window.scrollTo(0,0)` before rendering, so opening a new page (or a
  movie/blog detail) no longer leaves you scrolled halfway down.
- **Doomsday Watch Plan** on the Roadmap page: every movie now carries a
  `priority` (must-watch / recommended / optional) and `runtime_minutes`.
  The page calculates days left until *Avengers: Doomsday*'s release,
  total remaining runtime, minutes-per-day needed to finish the must-watch
  list in time, and a suggested day-by-day viewing schedule.
- **Blog**: any signed-in user can publish a post (title, tags, optional
  cover image uploaded to the `blog-covers` Supabase Storage bucket, body).
  Posts are public to read; comments are threaded per post.
- **Notifications**: a bell icon in the header lets a signed-in user opt
  in to browser notifications. This subscribes to a Supabase **Realtime**
  channel on `blog_posts` — the moment someone publishes, everyone with
  notifications on and the tab open gets a native notification.
  **Limitation:** this is foreground-only (see § Notifications below for
  what true push would take).
- **Shop**: an Amazon affiliate storefront. Product data lives in the
  `affiliate_products` table; your `AMAZON_AFFILIATE_TAG` is appended to
  every outbound link automatically, and the page carries the required
  Associates disclosure text.

---

## 5. Notifications — current scope vs. real push

What's implemented: opt-in browser notifications that fire **while the
site is open in a tab**, via `Notification.requestPermission()` +
Supabase Realtime watching for new `blog_posts` rows (`js/notifications.js`).

What real "notify me even when the app is closed" push would additionally
need — all buildable on Supabase, just out of scope for this client-only
pass:
1. A service worker (`sw.js`) registered on page load.
2. The Web Push API: generate VAPID keys, store each user's push
   subscription (endpoint + keys) in a new `push_subscriptions` table.
3. A Supabase **Edge Function**, triggered by a `blog_posts` insert
   (via a database webhook), that sends the actual push payload to every
   subscribed endpoint.

## 6. Amazon Associates — compliance notes

- Every affiliate link opens with `rel="noopener sponsored"` and the Shop
  page carries the required "as an Amazon Associate…" disclosure — don't
  remove it.
- Replace the placeholder `amazon_url` values in `02_seed.sql` (or in Table
  Editor) with your real product links before launch; the seed links are
  just Amazon search-result placeholders.
- Check the current rules for your Associates region (amazon.in vs
  amazon.com) before going live — commission rates and link requirements
  differ and change over time.

## 7. Other limitations worth knowing

- **The Marvel Comics API private key is still computed client-side**
  (`js/md5.js` + `js/api.js`) for demo simplicity. Move Marvel API calls
  behind a small Supabase Edge Function before a public launch so the
  private key never reaches the browser.
- **TMDB/OMDb/Watchmode keys in `js/config.js` are visible in page source**
  once deployed. That's expected for TMDB/OMDb (rate-limited per key, not
  secret-sensitive) — but if you want to hide usage or raise limits, proxy
  those calls through a Supabase Edge Function too.
- **"Where to watch" coverage** depends on TMDB/Watchmode's own licensing
  data for the India region and will be incomplete for very new or
  India-only releases.
- **Marvel API character matching** does a best-effort name search; it
  isn't a guaranteed 1:1 match for every alias.

---

## 8. File structure

```
marvelindia/
├── index.html
├── css/style.css
├── js/
│   ├── config.js          — every API key + Supabase project settings
│   ├── supabaseClient.js  — shared Supabase client init
│   ├── db.js              — every database/storage read & write
│   ├── auth.js            — Supabase Auth wrapper (signup/login/session)
│   ├── notifications.js   — Notification permission + Realtime subscribe
│   ├── md5.js             — MD5 for Marvel API request signing
│   ├── api.js             — fetch wrappers for TMDB/OMDb/TVmaze/Watchmode/Marvel
│   └── app.js             — router + view rendering (home, search, movie,
│                              timeline, roadmap, characters, wishlist,
│                              blog, shop)
├── supabase/
│   ├── 01_schema.sql       — tables + Row Level Security policies
│   ├── 02_seed.sql         — starter movies/timeline/characters/products
│   └── 03_storage.sql      — avatars + blog-covers buckets & policies
├── assets/                 — placeholder poster/avatar SVGs
└── README.md
```
