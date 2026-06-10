import { db } from "../db";
import { events } from "../db/schema";
import { like, and, eq, gte, lte } from "drizzle-orm";

/**
 * Check if an event already exists in the database
 * by source_event_id or by similar name/date/location
 */
export async function eventExists(
  sourceEventId: string,
  sourceType: string,
  name?: string,
  startDate?: Date
): Promise<boolean> {
  // First check by sourceEventId (most reliable)
  if (sourceEventId) {
    const existing = await db.query.events.findFirst({
      where: (t) =>
        and(
          eq(t.sourceEventId, sourceEventId),
          eq(t.sourceType, sourceType)
        ),
    });

    if (existing) return true;
  }

  // Secondary check by name + date (fuzzy)
  if (name && startDate) {
    const dateStart = new Date(startDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(startDate);
    dateEnd.setHours(23, 59, 59, 999);

    const similar = await db.query.events.findFirst({
      where: (t) =>
        and(
          like(t.name, `%${name.slice(0, 20)}%`),
          gte(t.startDate, dateStart),
          lte(t.startDate, dateEnd)
        ),
    });

    if (similar) return true;
  }

  return false;
}

/**
 * Deduplicate events array
 */
export function deduplicateEvents(
  events: any[]
): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];

  for (const event of events) {
    // Create a unique key from name + date
    const key = `${event.name}|${event.startDate.toISOString().split("T")[0]}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  return unique;
}
