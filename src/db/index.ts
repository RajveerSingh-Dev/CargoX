import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// Prevent build-time crashes during static page collection
const sql = neon(databaseUrl || "postgresql://dummy:dummy@localhost:5432/dummy");

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
};

export const db =
  globalForDb.db ??
  drizzle(sql, {
    schema,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}