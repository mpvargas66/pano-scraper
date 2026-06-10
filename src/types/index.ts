export type EventCategory = "Gastronomía" | "música" | "arte" | "bienestar" | "cine" | "familiar" | "bar" | "discoteca" | "otro";
export type EventType = "único" | "recurrente";

export interface RawEventData {
  name: string;
  description?: string;
  category: EventCategory;
  type: EventType;
  price: {
    isFree: boolean;
    minPrice?: number;
    maxPrice?: number;
    currency: "CLP";
  };
  minAge?: number;
  location: string;
  latitude?: number;
  longitude?: number;
  startDate: Date;
  endDate?: Date;
  schedules?: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isOpen: boolean;
  }>;
  imageUrl?: string;
  sourceUrl: string;
  sourceType: "ticketmaster" | "eventbrite" | "finde" | "ticketek" | "ticketplus" | "facebook";
  sourceEventId?: string;
}

export interface ScraperResult {
  source: string;
  success: boolean;
  eventsCount: number;
  events: RawEventData[];
  error?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}
