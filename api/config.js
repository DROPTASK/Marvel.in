// Vercel serverless function: /api/config or /api/config.js
// Supplies configuration dynamically from Vercel Environment Variables.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method === "OPTIONS") return res.status(200).end();

  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "",
    TMDB_API_KEY: process.env.TMDB_API_KEY || "",
    OMDB_API_KEY: process.env.OMDB_API_KEY || "",
    WATCHMODE_API_KEY: process.env.WATCHMODE_API_KEY || "",
    TMDB_MARVEL_COMPANY_ID: 420,
    TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
    TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",
    AMAZON_AFFILIATE_TAG: process.env.AMAZON_AFFILIATE_TAG || "marvelindia09-21"
  };

  const isScriptRequest = req.url && (req.url.endsWith(".js") || req.url.includes(".js?"));
  if (isScriptRequest) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    return res.status(200).send(`window.MARVEL_INDIA_CONFIG = Object.assign(window.MARVEL_INDIA_CONFIG || {}, ${JSON.stringify(config, null, 2)});`);
  }

  res.status(200).json(config);
}
