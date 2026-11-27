import type { BotCheck } from "./routes/contact.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Verifies a Cloudflare Turnstile response server-side. A missing token or any failure rejects. */
export function turnstileBotCheck(secret: string, fetcher: typeof fetch = fetch): BotCheck {
  return async ({ token, ip }) => {
    if (!token) return false;
    try {
      const res = await fetcher(VERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      });
      if (!res.ok) return false;
      return ((await res.json()) as { success?: boolean }).success === true;
    } catch (err) {
      console.error("[turnstile] verification failed:", err);
      return false;
    }
  };
}

/** Turnstile when TURNSTILE_SECRET_KEY is set, otherwise no check. */
export const turnstileFromEnv = (env: NodeJS.ProcessEnv = process.env): BotCheck | undefined =>
  env.TURNSTILE_SECRET_KEY ? turnstileBotCheck(env.TURNSTILE_SECRET_KEY) : undefined;
