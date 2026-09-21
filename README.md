# Marvel India (fixed original UI)

## Changes in this build
- **Sidebar** instead of bottom tab bar (drawer on mobile)
- **Posters fixed** — real `<img>` tags, HTTPS, `onerror` fallback to placeholder
- **Search suggestions** — local Marvel titles + live TMDB as you type
- **Doomsday clock** sits directly under the release date on Home
- **Movie detail** — poster on the **right**, smaller on mobile
- **Vercel-ready** — `/api/tmdb` and `/api/omdb` read secrets from Vercel env (no Supabase Edge Functions required)

## Keys on Vercel
1. Project → Settings → Environment Variables  
2. Add as **Secret**: `TMDB_API_KEY`, `OMDB_API_KEY`, `WATCHMODE_API_KEY` (optional Marvel keys)  
3. Redeploy after changing env vars  

Supabase URL + anon key still go in `js/config.js` (public).

## Local
```bash
npx serve .
# or
vercel dev
```
