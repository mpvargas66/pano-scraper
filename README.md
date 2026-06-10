# 🎪 Pano Scraper

**Event scraper service for Pano Panoramas** — automatically collects events from Ticketmaster, Eventbrite, and Finde (La Tercera) and normalizes them into a unified database.

## 📋 Features

- ✅ **Ticketmaster API** — Search events with classification mapping
- ✅ **Eventbrite API** — Fetch events with OAuth authentication  
- ✅ **Finde (La Tercera)** — Web scraping with Puppeteer
- ✅ **Automatic Geocoding** — Converts addresses to lat/lng with Google Maps API
- ✅ **Deduplication** — Prevents duplicate events in database
- ✅ **Vercel Cron Jobs** — Daily execution at 00:00 UTC
- ✅ **PostgreSQL (Neon)** — Shared database with web/mobile apps

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- `.env` file with API keys (see `.env.example`)
- PostgreSQL database (Neon recommended)

### 2. Installation

```bash
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required keys:
- `DATABASE_URL` — PostgreSQL connection string (from Neon)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps API key (use same as web app)
- `TICKETMASTER_API_KEY` — From https://developer.ticketmaster.com/
- `EVENTBRITE_API_TOKEN` — From https://www.eventbrite.com/platform/api/
- `CRON_SECRET` — Random string for protecting the cron endpoint

### 4. Test Locally

Run scraper once:

```bash
npm run dev  # or npm run scrape
```

Expected output:
```
🚀 Starting Pano Panoramas scraper...

📊 Scraping Results:
  Ticketmaster: 45 events
  Eventbrite: 32 events
  Finde: 28 events

✨ After deduplication: 98 events
✅ Scraper completed successfully!
  Inserted: 87 new events
  Skipped: 11 existing events
  Duration: 34.52s
```

---

## 📦 Deployment to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial scraper setup"
git remote add origin https://github.com/yourusername/pano-scraper.git
git push -u origin main
```

### Step 2: Create Vercel Project

1. Go to **https://vercel.com**
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Under **"Environment Variables"**, add all `.env` values
5. Deploy

### Step 3: Configure Cron Job

The `vercel.json` file already configures a daily cron at **00:00 UTC**. 

To verify it's working:
- Visit your Vercel dashboard
- Go to **Deployments** → **Functions** 
- Check **Cron Jobs** tab

### Step 4: Manual Trigger (Testing)

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-project.vercel.app/api/cron/scrape
```

Expected response:
```json
{
  "success": true,
  "inserted": 87,
  "skipped": 11,
  "total": 98,
  "timestamp": "2026-06-10T00:15:30Z"
}
```

---

## 🗂️ Project Structure

```
pano-scraper/
├── src/
│   ├── db/
│   │   ├── index.ts          # Drizzle ORM connection
│   │   └── schema.ts         # Events table schema
│   ├── scrapers/
│   │   ├── ticketmaster.ts   # Ticketmaster API scraper
│   │   ├── eventbrite.ts     # Eventbrite API scraper
│   │   └── finde.ts          # Finde web scraper (Puppeteer)
│   ├── utils/
│   │   ├── geocoding.ts      # Google Maps geocoding
│   │   └── dedup.ts          # Event deduplication
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── scraper.ts            # Main orchestrator
├── api/
│   └── cron/
│       └── scrape.ts         # Vercel Cron handler
├── package.json
├── tsconfig.json
├── vercel.json               # Cron configuration
└── .env.example
```

---

## 📊 Database Schema

Events stored in PostgreSQL with:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | text | Event name |
| `category` | enum | Gastronomía, música, arte, etc. |
| `type` | enum | "único" or "recurrente" |
| `price` | jsonb | `{ isFree, minPrice, maxPrice, currency }` |
| `minAge` | integer | Minimum age requirement |
| `location` | text | Venue/address |
| `latitude`, `longitude` | float | Geocoded coordinates |
| `startDate`, `endDate` | timestamp | Event dates |
| `schedules` | jsonb | Array of day/time patterns |
| `imageUrl` | text | Event image |
| `sourceUrl` | text | Original URL |
| `sourceType` | text | "ticketmaster", "eventbrite", "finde", etc. |
| `sourceEventId` | text | ID from original source |

---

## 🔧 Customization

### Add a New Scraper

1. Create `src/scrapers/newsource.ts`:

```typescript
import { RawEventData, ScraperResult } from "../types";

export async function scrapeNewSource(): Promise<ScraperResult> {
  // ... your scraping logic
  return {
    source: "newsource",
    success: true,
    eventsCount: events.length,
    events,
  };
}
```

2. Import and add to `src/scraper.ts`:

```typescript
import { scrapeNewSource } from "./scrapers/newsource";

const [ticketmaster, eventbrite, finde, newsource] = await Promise.all([
  scrapeTicketmaster(),
  scrapeEventbrite(),
  scrapeFinde(),
  scrapeNewSource(),  // ← Add here
]);
```

### Change Cron Schedule

Edit `vercel.json`:
```json
"schedule": "0 */6 * * *"  // Every 6 hours
"schedule": "30 2 * * *"   // Daily at 02:30 UTC
```

---

## 🐛 Troubleshooting

### Events not inserting

```bash
# Check database connection
npm run dev

# Verify API keys
echo $TICKETMASTER_API_KEY
echo $EVENTBRITE_API_TOKEN
```

### Geocoding failing

- Ensure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` has **Geocoding API** enabled
- Check rate limits (Google Maps free tier: 25,000 geocodes/day)

### Cron not running

1. Check Vercel dashboard → **Deployments** → **Functions**
2. Verify `vercel.json` is at root
3. Check environment variables in Vercel project settings

---

## 📝 API Response Example

```json
{
  "success": true,
  "inserted": 87,
  "skipped": 11,
  "total": 98,
  "timestamp": "2026-06-10T00:15:30Z"
}
```

---

## 🤝 Integration with Web/Mobile

Events scraped here are accessible via:

- **Web App (Next.js)** — `/api/events` endpoint
- **Mobile App (React Native)** — Same `/api/events` endpoint
- **Direct DB** — Query `public.events` table in Neon

Example query:
```sql
SELECT * FROM events 
WHERE category = 'música' 
  AND start_date >= NOW() 
  AND start_date <= NOW() + INTERVAL '30 days'
ORDER BY start_date ASC;
```

---

## 📄 License

MIT

---

**Questions?** Check Vercel logs: `vercel logs <url>`
