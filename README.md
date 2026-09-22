# Marvel India 🇮🇳 ⚡

A high-performance, Marvel-focused fan hub and community portal designed specifically for Indian Marvelites. Features live watch-provider lookups (Disney+ Hotstar, Prime Video, JioCinema), theatrical release countdowns, chronological MCU timeline, Doomsday watch-plan calculator, community dispatches, and curated merchandise.

---

## 🌟 Key Features

- **Theatrical Doomsday Countdown**: Flip-clock counter tracking days, hours, minutes, and seconds until the release of *Avengers: Doomsday*.
- **Accurate Media Routing (TV vs. Movies)**: Direct resolution for Marvel series (*WandaVision*, *Daredevil*, *Loki*) and films with automatic ID disambiguation and TMDB multi-search.
- **Where to Watch in India**: Real-time OTT platform availability powered by TMDB & Watchmode APIs with direct links to legal providers (Disney+ Hotstar, Rent on YouTube/Apple TV).
- **Interactive MCU Timeline & Roadmap**: Chronological watch order filterable by Infinity Saga, Multiverse Saga, Disney+ series, and X-Men Universe, paired with personal watch-progress tracking.
- **Community Dispatches & Reviews**: Full-featured fan blog with authentication, markdown article publishing, tags, and comment threads.
- **Amazon Merch Vault**: Curated merchandise showcase with dynamic Amazon India affiliate tracking tags.
- **Ad-Free User Experience**: Clean, distraction-free reading and browsing without banner ads or third-party ad networks.

---

## 🚀 Quick Start

### 1. Installation & Local Development
```bash
# Install dependencies
npm install

# Start development server
npm start
```
The application will be live at `http://localhost:3000`.

---

## 🔑 Environment Variables

Create a `.env` file in the project root (or configure variables in your hosting provider's dashboard):

```env
# Supabase (Database & Authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# External Movie & Streaming Metadata APIs
TMDB_API_KEY=your_tmdb_api_key
OMDB_API_KEY=your_omdb_api_key
WATCHMODE_API_KEY=your_watchmode_api_key

# Amazon Associates (Shop Monetization - Optional)
AMAZON_AFFILIATE_TAG=marvelindia-21
```

---

## 📦 Production Deployment

### Option 1: Vercel (Recommended)
1. Push your code to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. In **Settings** &rarr; **Environment Variables**, add the environment variables listed above.
4. Deploy! The included `vercel.json` automatically routes `/api/tmdb` and `/api/omdb` serverless functions and handles client-side SPA hash routing.

### Option 2: Node.js / Cloud Run / VPS
```bash
# Set production environment
export NODE_ENV=production

# Start production server
node server.js
```
The production server automatically serves static assets, provides dynamic client configuration at `/js/config.js`, proxies API requests securely, and handles HTML5 fallbacks.

---

## 🛡️ Fair Use & Trademark Notice

Marvel India is an independent, non-commercial fan community. Not affiliated with, endorsed by, or authorized by Marvel Studios, The Walt Disney Company, or Sony Pictures. All Marvel marks, logos, and characters are property of their respective owners.
