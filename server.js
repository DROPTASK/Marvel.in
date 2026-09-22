import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import omdbHandler from "./api/omdb.js";
import tmdbHandler from "./api/tmdb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel serverless functions emulation
app.all("/api/omdb", (req, res) => omdbHandler(req, res));
app.all("/api/tmdb", (req, res) => tmdbHandler(req, res));

// Dynamic config to support environment variables only
app.get("/js/config.js", (req, res) => {
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    TMDB_API_KEY: process.env.TMDB_API_KEY || "",
    OMDB_API_KEY: process.env.OMDB_API_KEY || "",
    WATCHMODE_API_KEY: process.env.WATCHMODE_API_KEY || "",
    TMDB_MARVEL_COMPANY_ID: 420,
    TMDB_IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
    TMDB_BACKDROP_BASE: "https://image.tmdb.org/t/p/original",
    AMAZON_AFFILIATE_TAG: process.env.AMAZON_AFFILIATE_TAG || "marvelindia09-21"
  };
  res.type("application/javascript");
  res.send(`window.MARVEL_INDIA_CONFIG = ${JSON.stringify(config, null, 2)};`);
});

// Serve static assets
app.use(express.static(__dirname));

// HTML5 client-side routing fallback (similar to vercel.json)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
