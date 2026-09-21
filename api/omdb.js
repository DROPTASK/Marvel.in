export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  const key = process.env.OMDB_API_KEY;
  if (!key) return res.status(500).json({ error: "OMDB_API_KEY not set on Vercel" });
  const params = new URLSearchParams({ ...req.query, apikey: key });
  try {
    const r = await fetch(`https://www.omdbapi.com/?${params}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
