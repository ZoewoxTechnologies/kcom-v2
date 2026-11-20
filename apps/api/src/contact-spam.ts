import { sql } from "drizzle-orm";
import { rateLimits, type CapsuleDb } from "@kcom/db";

export const CONTACT_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
export const RECAPTCHA_MIN_SCORE = 0.5;
const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export type RecaptchaOptions = {
  /** Unset skips the check (local dev, tests) with a logged warning. */
  secret?: string;
  fetcher?: typeof fetch;
};

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

export type RecaptchaVerdict = { ok: true } | { ok: false; reason: string };

export async function verifyRecaptcha(token: string | undefined, { secret, fetcher = fetch }: RecaptchaOptions): Promise<RecaptchaVerdict> {
  if (!secret) {
    console.warn("[contact] RECAPTCHA_SECRET_KEY is not set; skipping reCAPTCHA verification");
    return { ok: true };
  }
  if (!token) return { ok: false, reason: "missing token" };
  try {
    const res = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const data = (await res.json()) as { success?: boolean; score?: number };
    if (data.success !== true) return { ok: false, reason: "token rejected" };
    const score = data.score ?? 0;
    return score >= RECAPTCHA_MIN_SCORE ? { ok: true } : { ok: false, reason: `low score ${score}` };
  } catch (error) {
    // Fail closed: an unreachable verifier must not open the door to spam.
    return { ok: false, reason: `verification failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
