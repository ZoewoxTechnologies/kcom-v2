import { sql } from "drizzle-orm";
import { rateLimits, type CapsuleDb } from "@kcom/db";

export const CONTACT_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
/** Client IP as the proxy reports it; the first x-forwarded-for hop, matching the auth rate limiter. */
export const clientIp = (header: string | undefined) => header?.split(",")[0]?.trim() || "unknown";

/** Counts this attempt for `ip` in a fixed window held in rate_limits; true when the attempt is over the limit. */
export async function overRateLimit(db: CapsuleDb, ip: string, now = Date.now()): Promise<boolean> {
  const key = `contact:${ip}`;
  const expired = sql`${rateLimits.lastRequest} < ${now - CONTACT_RATE_LIMIT.windowMs}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ id: key, key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        // lastRequest holds the window start for these keys.
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimits.lastRequest} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row!.count > CONTACT_RATE_LIMIT.max;
}
