import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums for categories and types
export const categoryEnum = pgEnum("category", [
  "Gastronomía",
  "música",
  "arte",
  "bienestar",
  "cine",
  "familiar",
  "bar",
  "discoteca",
  "otro",
]);

export const eventTypeEnum = pgEnum("event_type", ["único", "recurrente"]);

// Events table
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    category: categoryEnum("category").notNull(),
    type: eventTypeEnum("type").notNull(), // "único" | "recurrente"
    
    // Price
    price: jsonb("price").notNull(), // { isFree: bool, minPrice?: number, maxPrice?: number, currency: "CLP" }
    
    // Age
    minAge: integer("min_age"),
    
    // Location & Geocoding
    location: text("location").notNull(),
    latitude: integer("latitude"),
    longitude: integer("longitude"),
    
    // Dates
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    
    // Schedules (array of day/time patterns)
    schedules: jsonb("schedules"), // Array<{ dayOfWeek: 0-6, openTime: "HH:mm", closeTime: "HH:mm", isOpen: boolean }>
    
    // Media
    imageUrl: text("image_url"),
    sourceUrl: text("source_url").notNull(), // Original URL from scraper source
    sourceType: text("source_type").notNull(), // "ticketmaster" | "eventbrite" | "finde" | "ticketek" | etc.
    sourceEventId: text("source_event_id"), // ID from original source (for deduplication)
    
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("events_category_idx").on(t.category),
    typeIdx: index("events_type_idx").on(t.type),
    sourceIdx: index("events_source_idx").on(t.sourceType),
    sourceEventIdx: index("events_source_event_idx").on(t.sourceEventId),
    locIdx: index("events_location_idx").on(t.location),
    startDateIdx: index("events_start_date_idx").on(t.startDate),
  })
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
