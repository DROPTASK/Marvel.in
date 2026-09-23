import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import omdbHandler from "./api/omdb.js";
import tmdbHandler from "./api/tmdb.js";
import configHandler from "./api/config.js";
import sendEmailHandler from "./api/send-email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel serverless functions emulation
app.all("/api/omdb", (req, res) => omdbHandler(req, res));
app.all("/api/tmdb", (req, res) => tmdbHandler(req, res));
app.all("/api/config", (req, res) => configHandler(req, res));
app.all("/api/config.js", (req, res) => configHandler(req, res));
app.all("/api/send-email", (req, res) => sendEmailHandler(req, res));
app.get("/js/config.js", (req, res) => configHandler(req, res));

// Serve static assets
app.use(express.static(__dirname));

// HTML5 client-side routing fallback (similar to vercel.json)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
