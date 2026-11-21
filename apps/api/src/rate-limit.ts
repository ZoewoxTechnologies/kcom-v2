import { sql } from "drizzle-orm";
import { rateLimits, type CapsuleDb } from "@kcom/db";

export type RateLimit = { max: number; windowMs: number };

/**
 * Counts one hit for `key` in a fixed window held in rate_limits and returns true when the key is
 * over `limit`. The window start is kept in lastRequest for these keys.
 */
export async function overLimit(
  db: CapsuleDb,
  key: string,
  limit: RateLimit,
  now = Date.now(),
): Promise<boolean> {
  const expired = sql`${rateLimits.lastRequest} < ${now - limit.windowMs}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ id: key, key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimits.lastRequest} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row!.count > limit.max;
}
