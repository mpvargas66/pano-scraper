import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create postgres client with pooler connection
const client = postgres(DATABASE_URL, {
  ssl: "require",
  max: 1, // Serverless function single connection
});

export const db = drizzle(client, { schema });
export { schema };
