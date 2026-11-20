import { sql } from "drizzle-orm";
import { rateLimits, type CapsuleDb } from "@kcom/db";

export const CONTACT_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/**
 * Client IP from the RIGHT of x-forwarded-for: each trusted proxy appends the address it saw, so the entry
 * `hops` from the end is the one our own proxy recorded; anything to its left is client-supplied and ignored.
 * Falls back to the socket address, and is undefined when neither is usable (never a shared bucket).
 */
export function clientIp(header: string | undefined, hops: number, socketAddress?: string): string | undefined {
  const parts = (header ?? "").split(",").map((p) => p.trim());
  const fromHeader = hops >= 1 ? parts[parts.length - hops] : undefined;
  return fromHeader || socketAddress || undefined;
}

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
