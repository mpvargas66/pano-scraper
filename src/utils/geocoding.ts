import axios from "axios";
import { GeocodingResult } from "../types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.warn("GOOGLE_MAPS_API_KEY not found. Geolocation will be skipped.");
}

/**
 * Geocode a location string to get latitude/longitude
 * Using Google Geocoding API with RM, Chile bias
 */
export async function geocodeLocation(
  address: string,
  retries = 3
): Promise<GeocodingResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: `${address}, Región Metropolitana, Chile`,
          key: GOOGLE_MAPS_API_KEY,
          components: "country:CL",
        },
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }

    return null;
  } catch (error) {
    if (retries > 0) {
      // Retry after 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return geocodeLocation(address, retries - 1);
    }

    console.error(`Geocoding error for "${address}":`, error);
    return null;
  }
}

/**
 * Batch geocode multiple locations
 */
export async function batchGeocode(
  locations: string[]
): Promise<Record<string, GeocodingResult | null>> {
  const results: Record<string, GeocodingResult | null> = {};

  for (const location of locations) {
    const geo = await geocodeLocation(location);
    results[location] = geo;
    // Rate limiting: 1 request per 200ms (max ~5 req/sec)
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return results;
}
