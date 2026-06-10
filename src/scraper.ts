import "dotenv/config";
import { db } from "./db";
import { events } from "./db/schema";
import { eq } from "drizzle-orm";
import { scrapeTicketmaster } from "./scrapers/ticketmaster";
import { scrapeEventbrite } from "./scrapers/eventbrite";
import { scrapeFinde } from "./scrapers/finde";
import { geocodeLocation } from "./utils/geocoding";
import { eventExists, deduplicateEvents } from "./utils/dedup";
import { RawEventData } from "./types";

/**
 * Main scraper function
 * Executes all scrapers and saves unique events to database
 */
export async function runScraper() {
  console.log("🚀 Starting Pano Panoramas scraper...");
  const startTime = Date.now();

  try {
    // Run all scrapers in parallel
    const [ticketmasterResult, eventbriteResult, findeResult] = await Promise.all(
      [
        scrapeTicketmaster(),
        scrapeEventbrite(),
        scrapeFinde(),
      ]
    );

    console.log("\n📊 Scraping Results:");
    console.log(`  Ticketmaster: ${ticketmasterResult.eventsCount} events`);
    console.log(`  Eventbrite: ${eventbriteResult.eventsCount} events`);
    console.log(`  Finde: ${findeResult.eventsCount} events`);

    // Combine and deduplicate
    const allEvents = [
      ...ticketmasterResult.events,
      ...eventbriteResult.events,
      ...findeResult.events,
    ];

    const dedupedEvents = deduplicateEvents(allEvents);
    console.log(`\n✨ After deduplication: ${dedupedEvents.length} events`);

    // Process and save events
    let insertedCount = 0;
    let skippedCount = 0;

    for (const rawEvent of dedupedEvents) {
      try {
        // Check if event already exists
        const exists = await eventExists(
          rawEvent.sourceEventId || "",
          rawEvent.sourceType,
          rawEvent.name,
          rawEvent.startDate
        );

        if (exists) {
          skippedCount++;
          continue;
        }

        // Geocode location if not already provided
        let latitude = rawEvent.latitude;
        let longitude = rawEvent.longitude;

        if (!latitude || !longitude) {
          const geoResult = await geocodeLocation(rawEvent.location);
          if (geoResult) {
            latitude = geoResult.latitude;
            longitude = geoResult.longitude;
          }
        }

        // Insert event
        await db.insert(events).values({
          name: rawEvent.name,
          description: rawEvent.description,
          category: rawEvent.category,
          type: rawEvent.type,
          price: {
            isFree: rawEvent.price.isFree,
            minPrice: rawEvent.price.minPrice,
            maxPrice: rawEvent.price.maxPrice,
            currency: rawEvent.price.currency,
          },
          minAge: rawEvent.minAge,
          location: rawEvent.location,
          latitude: latitude ? Math.round(latitude * 1000000) / 1000000 : null,
          longitude: longitude ? Math.round(longitude * 1000000) / 1000000 : null,
          startDate: rawEvent.startDate,
          endDate: rawEvent.endDate,
          schedules: rawEvent.schedules || null,
          imageUrl: rawEvent.imageUrl,
          sourceUrl: rawEvent.sourceUrl,
          sourceType: rawEvent.sourceType,
          sourceEventId: rawEvent.sourceEventId,
        });

        insertedCount++;
      } catch (err) {
        console.error(`Error inserting event "${rawEvent.name}":`, err);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Scraper completed successfully!`);
    console.log(`  Inserted: ${insertedCount} new events`);
    console.log(`  Skipped: ${skippedCount} existing events`);
    console.log(`  Duration: ${duration}s`);

    return {
      success: true,
      inserted: insertedCount,
      skipped: skippedCount,
      total: dedupedEvents.length,
    };
  } catch (error) {
    console.error("❌ Scraper failed:", error);
    throw error;
  }
}

// Run scraper if executed directly
if (require.main === module) {
  runScraper()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
