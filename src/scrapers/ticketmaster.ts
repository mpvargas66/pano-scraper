import axios from "axios";
import { RawEventData, EventCategory, ScraperResult } from "../types";

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

const CLASSIFICATION_MAP: Record<string, EventCategory> = {
  music: "música",
  concert: "música",
  theater: "arte",
  arts: "arte",
  comedy: "arte",
  family: "familiar",
  food: "Gastronomía",
  wellness: "bienestar",
  film: "cine",
  movie: "cine",
};

function mapCategory(name: string): EventCategory {
  const n = name.toLowerCase();
  for (const [key, cat] of Object.entries(CLASSIFICATION_MAP)) {
    if (n.includes(key)) return cat;
  }
  return "otro";
}

export async function scrapeTicketmaster(): Promise<ScraperResult> {
  if (!TICKETMASTER_API_KEY) {
    return { source: "ticketmaster", success: false, eventsCount: 0, events: [], error: "No API key" };
  }

  try {
    const response = await axios.get(
      "https://app.ticketmaster.com/discovery/v2/events.json",
      {
        params: {
          countryCode: "CL",
          size: 100,
          apikey: TICKETMASTER_API_KEY,
          sort: "date,asc",
        },
      }
    );

    const rawEvents = response.data?._embedded?.events || [];
    console.log(`Ticketmaster raw events received: ${rawEvents.length}`);

    const events: RawEventData[] = [];

    for (const e of rawEvents) {
      try {
        const genre = e.classifications?.[0]?.genre?.name || "entertainment";
        const category = mapCategory(genre);
        const priceRanges = e.priceRanges || [];
        const isFree = priceRanges.length === 0;

        const startDateRaw = e.dates?.start?.dateTime || e.dates?.start?.localDate;
        if (!startDateRaw) continue;

        events.push({
          name: e.name,
          description: e.info || e.pleaseNote,
          category,
          type: "único",
          price: {
            isFree,
            minPrice: priceRanges[0]?.min,
            maxPrice: priceRanges[0]?.max,
            currency: "CLP",
          },
          location: e._embedded?.venues?.[0]?.name || "Santiago",
          latitude: parseFloat(e._embedded?.venues?.[0]?.location?.latitude) || undefined,
          longitude: parseFloat(e._embedded?.venues?.[0]?.location?.longitude) || undefined,
          startDate: new Date(startDateRaw),
          imageUrl: e.images?.[0]?.url,
          sourceUrl: e.url,
          sourceType: "ticketmaster",
          sourceEventId: e.id,
        });
      } catch (err) {
        continue;
      }
    }

    return { source: "ticketmaster", success: true, eventsCount: events.length, events };
  } catch (error) {
    console.error("Ticketmaster error:", error);
    return { source: "ticketmaster", success: false, eventsCount: 0, events: [], error: String(error) };
  }
}
