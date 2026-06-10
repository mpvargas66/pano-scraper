import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, uuid, text, doublePrecision, timestamp, pgEnum, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { eq, and } from "drizzle-orm";
import { scrapeTicketmaster } from "./scrapers/ticketmaster";
import { geocodeLocation } from "./utils/geocoding";

const DATABASE_URL = process.env.DATABASE_URL!;
const client = postgres(DATABASE_URL, { ssl: "require", max: 1 });
const db = drizzle(client);

// Schema real de pano-web
const categoryEnum = pgEnum("category", ["gastro","musica","arte","bienestar","cine","familiar","bar","discoteca"]);
const eventStatusEnum = pgEnum("event_status", ["draft","published","archived"]);

const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  zone: text("zone"),
  region: text("region"),
  comuna: text("comuna"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  googlePlaceId: text("google_place_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  titleEs: text("title_es").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionEs: text("description_es"),
  descriptionEn: text("description_en"),
  category: categoryEnum("category").notNull(),
  venueId: uuid("venue_id"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  priceClp: integer("price_clp").notNull().default(0),
  petFriendly: boolean("pet_friendly").notNull().default(false),
  family: boolean("family").notNull().default(false),
  nightlife: boolean("nightlife").notNull().default(false),
  imageUrl: text("image_url"),
  status: eventStatusEnum("status").notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Mapeo de categorías del scraper al enum real
function mapCategory(scraperCategory: string): "gastro"|"musica"|"arte"|"bienestar"|"cine"|"familiar"|"bar"|"discoteca" {
  const map: Record<string, any> = {
    "música": "musica",
    "Gastronomía": "gastro",
    "arte": "arte",
    "bienestar": "bienestar",
    "cine": "cine",
    "familiar": "familiar",
    "bar": "bar",
    "discoteca": "discoteca",
    "otro": "musica", // fallback
  };
  return map[scraperCategory] || "musica";
}

// Genera un slug único
function generateSlug(name: string, date: Date): string {
  const base = name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const dateStr = date.toISOString().split("T")[0];
  return `${base}-${dateStr}`;
}

export async function runScraper() {
  console.log("🚀 Starting Pano Panoramas scraper...");
  const startTime = Date.now();

  const ticketmasterResult = await scrapeTicketmaster();
  console.log(`\n📊 Scraping Results:`);
  console.log(`  Ticketmaster: ${ticketmasterResult.eventsCount} events`);

  const allEvents = [...ticketmasterResult.events];
  let insertedCount = 0;
  let skippedCount = 0;

  for (const rawEvent of allEvents) {
    try {
      const slug = generateSlug(rawEvent.name, rawEvent.startDate);

      // Verificar si ya existe por slug
      const existing = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      // Obtener o crear venue
      let venueId: string | null = null;
      let lat = rawEvent.latitude || 0;
      let lng = rawEvent.longitude || 0;

      // Geocodificar si no tiene coordenadas
      if (!lat || !lng) {
        const geo = await geocodeLocation(rawEvent.location);
        if (geo) { lat = geo.latitude; lng = geo.longitude; }
      }

      if (lat && lng) {
        // Buscar venue existente por nombre
        const existingVenue = await db.select().from(venues)
          .where(eq(venues.name, rawEvent.location)).limit(1);

        if (existingVenue.length > 0) {
          venueId = existingVenue[0].id;
        } else {
          // Crear nuevo venue
          const newVenue = await db.insert(venues).values({
            name: rawEvent.location,
            lat,
            lng,
            region: "Región Metropolitana",
          }).returning();
          venueId = newVenue[0].id;
        }
      }

      // Insertar evento
      await db.insert(events).values({
        slug,
        titleEs: rawEvent.name,
        titleEn: rawEvent.name,
        descriptionEs: rawEvent.description,
        descriptionEn: rawEvent.description,
        category: mapCategory(rawEvent.category),
        venueId,
        startAt: rawEvent.startDate,
        endAt: rawEvent.endDate,
        priceClp: rawEvent.price.minPrice
          ? Math.round(rawEvent.price.minPrice * 950)
          : -1,
        family: rawEvent.category === "familiar",
        nightlife: rawEvent.category === "bar" || rawEvent.category === "discoteca",
        imageUrl: rawEvent.imageUrl,
        status: "published",
      });

      insertedCount++;
      console.log(`  ✅ Inserted: ${rawEvent.name}`);
    } catch (err) {
      console.error(`  ❌ Error inserting "${rawEvent.name}":`, err);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Scraper completed!`);
  console.log(`  Inserted: ${insertedCount} new events`);
  console.log(`  Skipped: ${skippedCount} existing events`);
  console.log(`  Duration: ${duration}s`);

  return { success: true, inserted: insertedCount, skipped: skippedCount, total: allEvents.length };
}

if (require.main === module) {
  runScraper().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
