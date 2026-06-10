import axios from "axios";
import { RawEventData, EventCategory, EventType, ScraperResult } from "../types";

const EVENTBRITE_API_TOKEN = process.env.EVENTBRITE_API_TOKEN;

// Category mapping from Eventbrite subcategories
const CATEGORY_MAP: Record<string, EventCategory> = {
  music: "música",
  live_music: "música",
  conferences: "arte",
  workshop: "bienestar",
  comedy: "arte",
  food: "Gastronomía",
  dining: "Gastronomía",
  movie: "cine",
  film: "cine",
  sports: "otro",
  family: "familiar",
  kids: "familiar",
  wellness: "bienestar",
  health: "bienestar",
  nightlife: "bar",
  nightclub: "discoteca",
  club: "discoteca",
  art: "arte",
  entertainment: "otro",
};

function mapCategoryToOurs(
  subcategory?: string,
  category?: string
): EventCategory {
  if (subcategory) {
    const normalized = subcategory.toLowerCase();
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
      if (normalized.includes(key)) {
        return cat;
      }
    }
  }

  if (category) {
    const normalized = category.toLowerCase();
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
      if (normalized.includes(key)) {
        return cat;
      }
    }
  }

  return "otro";
}

export async function scrapeEventbrite(): Promise<ScraperResult> {
  if (!EVENTBRITE_API_TOKEN) {
    return {
      source: "eventbrite",
      success: false,
      eventsCount: 0,
      events: [],
      error: "EVENTBRITE_API_TOKEN not configured",
    };
  }

  try {
    // NOTE: Eventbrite removed the public /v3/events/search/ endpoint in 2023.
    // This requires organization-level API access. Returning empty for now.
    return {
      source: "eventbrite",
      success: true,
      eventsCount: 0,
      events: [],
      error: "Eventbrite public search API deprecated — requires org-level access",
    };

    // Search events in Chile
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const response = await axios.get(
      "https://www.eventbriteapi.com/v3/events/search/",
      {
        headers: {
          Authorization: `Bearer ${EVENTBRITE_API_TOKEN}`,
        },
        params: {
          "location.address": "Santiago, Chile",
          "location.within": "50km",
          start_date: now.toISOString(),
          end_date: futureDate.toISOString(),
          expand: "venue,category",
          sort_by: "date",
          size: 50,
        },
      }
    );

    const rawEvents = response.data.events || [];
    const events: RawEventData[] = [];

    for (const rawEvent of rawEvents) {
      try {
        const category = mapCategoryToOurs(
          rawEvent.category?.name,
          rawEvent.subcategory?.name
        );

        // Parse price
        const ticketClasses = rawEvent.ticket_classes || [];
        const isFree = ticketClasses.length === 0 || ticketClasses.some((t: any) => t.free);
        const prices = ticketClasses
          .filter((t: any) => !t.free && t.cost)
          .map((t: any) => t.cost?.display?.replace(/[^0-9]/g, "") || 0)
          .map(Number);

        const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;

        const event: RawEventData = {
          name: rawEvent.name?.text,
          description: rawEvent.description?.text,
          category,
          type: rawEvent.series_id ? "recurrente" : "único",
          price: {
            isFree,
            minPrice,
            maxPrice,
            currency: "CLP",
          },
          minAge: undefined,
          location: rawEvent.venue?.name || "TBD",
          latitude: rawEvent.venue?.latitude,
          longitude: rawEvent.venue?.longitude,
          startDate: new Date(rawEvent.start?.utc),
          endDate: rawEvent.end ? new Date(rawEvent.end.utc) : undefined,
          imageUrl: rawEvent.logo?.url,
          sourceUrl: rawEvent.url,
          sourceType: "eventbrite",
          sourceEventId: rawEvent.id,
        };

        events.push(event);
      } catch (err) {
        console.error(`Error mapping Eventbrite event: ${err}`);
        continue;
      }
    }

    return {
      source: "eventbrite",
      success: true,
      eventsCount: events.length,
      events,
    };
  } catch (error) {
    console.error("Eventbrite scraping error:", error);
    return {
      source: "eventbrite",
      success: false,
      eventsCount: 0,
      events: [],
      error: String(error),
    };
  }
}
