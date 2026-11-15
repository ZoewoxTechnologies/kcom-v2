import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

/**
 * The only file that knows how we connect. Uses plain node-postgres so the
 * database host stays swappable. Idle connections close after 10s so a
 * scale-to-zero host (Neon) can sleep between requests.
 */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000, // allow for a cold start
    statement_timeout: 20_000,
    query_timeout: 25_000,
    allowExitOnIdle: true,
  });
  // The host may drop idle connections (Neon scale-to-zero); don't crash on it.
  pool.on("error", (err) => console.error("postgres pool error:", err.message));
  return Object.assign(drizzle(pool, { schema }), { pool });
}

export type Db = ReturnType<typeof createDb>;
