import type { CapsuleDb } from "@kcom/db";
import { overLimit } from "./rate-limit.js";

export const CONTACT_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
/** Counts this attempt for `ip` in a fixed window held in rate_limits; true when the attempt is over the limit. */
export function overRateLimit(db: CapsuleDb, ip: string, now = Date.now()): Promise<boolean> {
  return overLimit(db, `contact:${ip}`, CONTACT_RATE_LIMIT, now);
}
