// Vercel serverless: /api/tmdb?path=/search/movie&query=iron+man
// Set TMDB_API_KEY in Vercel Project → Settings → Environment Variables
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  const key = process.env.TMDB_API_KEY;
  if (!key) return res.status(500).json({ error: "TMDB_API_KEY not configured in environment" });
  const { path = "/search/movie", ...rest } = req.query;
  const params = new URLSearchParams({ api_key: key, ...rest });
  delete params.api_key; // ensure single
  params.set("api_key", key);
  Object.entries(rest).forEach(([k, v]) => { if (k !== "path") params.set(k, v); });
  try {
    const r = await fetch(`https://api.themoviedb.org/3${path}?${params}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
