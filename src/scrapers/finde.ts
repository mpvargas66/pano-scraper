import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { RawEventData, EventCategory, EventType, ScraperResult } from "../types";

puppeteer.use(StealthPlugin());

// Category mapping from Finde sections
const FINDE_CATEGORY_MAP: Record<string, EventCategory> = {
  música: "música",
  conciertos: "música",
  theater: "arte",
  teatro: "arte",
  art: "arte",
  exposiciones: "arte",
  family: "familiar",
  infantil: "familiar",
  kids: "familiar",
  food: "Gastronomía",
  gastronomía: "Gastronomía",
  restaurantes: "Gastronomía",
  wellness: "bienestar",
  bienestar: "bienestar",
  yoga: "bienestar",
  movie: "cine",
  cine: "cine",
  películas: "cine",
  nightlife: "bar",
  bar: "bar",
  club: "discoteca",
  discoteca: "discoteca",
};

function mapFindeCategory(category?: string): EventCategory {
  if (!category) return "otro";

  const normalized = category.toLowerCase();
  for (const [key, cat] of Object.entries(FINDE_CATEGORY_MAP)) {
    if (normalized.includes(key)) {
      return cat;
    }
  }

  return "otro";
}

export async function scrapeFinde(): Promise<ScraperResult> {
  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to Finde
    await page.goto("https://finde.latercera.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for event cards to load
    await page.waitForSelector("[data-event-id], .event-card", {
      timeout: 10000,
    }).catch(() => null);

    // Get page HTML
    const html = await page.content();
    const $ = cheerio.load(html);

    const events: RawEventData[] = [];
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Select event cards (adjust selector based on actual Finde structure)
    const eventCards = $(".event-card, [data-event-id]");

    eventCards.each((_, element) => {
      try {
        const $card = $(element);

        // Extract data
        const name = $card.find("h3, .event-title").text().trim();
        const description = $card.find(".event-description, p").text().trim();
        const category = mapFindeCategory(
          $card.find(".category, .event-category").text()
        );
        const locationText = $card.find(".location, .venue").text().trim();
        const priceText = $card.find(".price, [data-price]").text().trim();
        const dateText = $card.find(".date, [data-date]").text().trim();
        const imageUrl = $card.find("img").attr("src");
        const sourceUrl = $card.find("a").attr("href") || "";

        // Parse price
        const isFree = priceText.toLowerCase().includes("gratis");
        let minPrice: number | undefined;
        let maxPrice: number | undefined;

        if (!isFree && priceText) {
          const numbers = priceText.match(/\d+/g);
          if (numbers) {
            minPrice = parseInt(numbers[0]);
            maxPrice = numbers.length > 1 ? parseInt(numbers[1]) : minPrice;
          }
        }

        // Parse date (basic parsing, may need adjustment)
        let startDate = now;
        if (dateText) {
          // Try to parse date (this is very basic and needs refinement)
          startDate = new Date(dateText) || now;
        }

        if (startDate > futureDate) return; // Skip events beyond 30 days

        const event: RawEventData = {
          name: name || "Evento sin nombre",
          description,
          category,
          type: "único" as EventType,
          price: {
            isFree,
            minPrice,
            maxPrice,
            currency: "CLP",
          },
          minAge: undefined,
          location: locationText || "Santiago, RM",
          startDate,
          imageUrl,
          sourceUrl: sourceUrl.startsWith("http")
            ? sourceUrl
            : `https://finde.latercera.com${sourceUrl}`,
          sourceType: "finde",
          sourceEventId: `finde-${name.toLowerCase().replace(/\s+/g, "-")}`,
        };

        events.push(event);
      } catch (err) {
        console.error(`Error parsing Finde event: ${err}`);
      }
    });

    return {
      source: "finde",
      success: true,
      eventsCount: events.length,
      events,
    };
  } catch (error) {
    console.error("Finde scraping error:", error);
    return {
      source: "finde",
      success: false,
      eventsCount: 0,
      events: [],
      error: String(error),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
