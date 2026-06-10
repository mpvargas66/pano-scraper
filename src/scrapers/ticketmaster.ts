import axios from "axios";
import { RawEventData, EventCategory, EventType, ScraperResult } from "../types";

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

// Category mapping from Ticketmaster classifications
const CLASSIFICATION_MAP: Record<string, EventCategory> = {
  music: "música",
  concert: "música",
  sports: "otro",
  theater: "arte",
  arts: "arte",
  comedy: "arte",
  family: "familiar",
  food: "Gastronomía",
  dining: "Gastronomía",
  wellness: "bienestar",
  film: "cine",
  movie: "cine",
  entertainment: "otro",
};

async function mapClassificationToCategory(
  classificationName: string
): Promise<EventCategory> {
  const normalized = classificationName.toLowerCase();
  
  for (const [key, category] of Object.entries(CLASSIFICATION_MAP)) {
    if (normalized.includes(key)) {
      return category;
    }
  }

  return "otro";
}

export async function scrapeTicketmaster(): Promise<ScraperResult> {
  if (!TICKETMASTER_API_KEY) {
    return {
      source: "ticketmaster",
      success: false,
      eventsCount: 0,
      events: [],
      error: "TICKETMASTER_API_KEY not configured",
    };
  }

  try {
    // Search events in Chile (countryCode: CL)
    // Radius search around Santiago (RM)
    const response = await axios.get(
      "https://app.ticketmaster.com/discovery/v2/events.json",
      {
        params: {
          countryCode: "CL",
          size: 50, // Max 50 per page
          apikey: TICKETMASTER_API_KEY,
          startDateTime: new Date().toISOString().split(".")[0] + "Z",
          endDateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z",
        },
      }
    );

    const rawEvents = response.data._embedded?.events || [];
    const events: RawEventData[] = [];

    for (const rawEvent of rawEvents) {
      try {
        const classifications = rawEvent.classifications || [];
        const genre = classifications[0]?.genre?.name || "entertainment";
        const category = await mapClassificationToCategory(genre);

        // Parse price
        const priceRanges = rawEvent.priceRanges || [];
        const isFree = priceRanges.length === 0 || priceRanges[0]?.min === 0;
        const minPrice = priceRanges[0]?.min || undefined;
        const maxPrice = priceRanges[0]?.max || undefined;

        const event: RawEventData = {
          name: rawEvent.name,
          description: rawEvent.description,
          category,
          type: "único" as EventType,
          price: {
            isFree,
            minPrice,
            maxPrice,
            currency: "CLP",
          },
          minAge: undefined, // Ticketmaster doesn't provide this directly
          location: rawEvent._embedded?.venues?.[0]?.name || "TBD",
          latitude: parseFloat(rawEvent._embedded?.venues?.[0]?.location?.latitude || "0") || undefined,
          longitude: parseFloat(rawEvent._embedded?.venues?.[0]?.location?.longitude || "0") || undefined,
          startDate: new Date(rawEvent.dates.start.dateTime),
          endDate: rawEvent.dates.end ? new Date(rawEvent.dates.end.dateTime) : undefined,
          imageUrl: rawEvent.images?.[0]?.url,
          sourceUrl: rawEvent.url,
          sourceType: "ticketmaster",
          sourceEventId: rawEvent.id,
        };

        events.push(event);
      } catch (err) {
        console.error(`Error mapping Ticketmaster event: ${err}`);
        continue;
      }
    }

    return {
      source: "ticketmaster",
      success: true,
      eventsCount: events.length,
      events,
    };
  } catch (error) {
    console.error("Ticketmaster scraping error:", error);
    return {
      source: "ticketmaster",
      success: false,
      eventsCount: 0,
      events: [],
      error: String(error),
    };
  }
}
