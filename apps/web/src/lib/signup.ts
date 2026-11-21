/**
 * Email signup (double opt-in).
 *
 * API contract:
 * - POST {api}/subscribers { email, turnstileToken?, hp_url? } answers 202 whether or not the
 *   address is already known, so it never reveals who is subscribed. 400 means a bad email,
 *   429 means rate limited.
 * - The emailed confirm and unsubscribe links are served by the API, which redirects the
 *   reader to one of the pages in `signupStates`.
 */

export const signupStates = {
  checkInbox: "/subscribe/check-inbox",
  confirmed: "/subscribe/confirmed",
  expired: "/subscribe/expired",
  unsubscribed: "/subscribe/unsubscribed",
} as const;

/** Holds the address between the form and the check-inbox page, so it never sits in a URL. */
export const SIGNUP_EMAIL_COOKIE = "kc_signup_email";
export const SIGNUP_COOKIE_MAX_AGE = 30 * 60;

export const EMAIL_REQUIRED = "Please enter your email address.";
export const EMAIL_INVALID = "Please enter a full email address.";
export const SIGNUP_RATE_LIMITED = "Too many signups just now. Please try again in a little while.";
export const SIGNUP_FAILED = "Sorry, we could not sign you up. Please try again in a moment.";

export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return EMAIL_REQUIRED;
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return EMAIL_INVALID;
  return null;
}

/** On failure, `status` is the HTTP status the form page should answer with. */
export type SignupResult = { ok: true } | { ok: false; message: string; status: 400 | 429 | 502 };

export interface SignupInput {
  email: string;
  /** Cloudflare Turnstile response; absent when the site has no Turnstile key. */
  turnstileToken?: string;
  /** Honeypot: hidden on the form, so only bots fill it. */
  hp_url?: string;
  /** The visitor's address, sent as x-forwarded-for so the API rate-limits per visitor, not per web server. */
  clientIp?: string;
}

/** The visitor's address: the last x-forwarded-for entry (added by our own proxy), else the socket address. */
export function visitorIp(forwardedFor: string | null | undefined, socketAddress?: string): string | undefined {
  const last = (forwardedFor ?? "").split(",").at(-1)?.trim();
  return last || socketAddress || undefined;
}

/** POST the signup to the API. Only a 2xx response is `ok`; everything else, including network errors, is a failure. */
export async function submitSignup(
  apiUrl: string | undefined,
  input: SignupInput,
  fetcher: typeof fetch = fetch,
): Promise<SignupResult> {
  const fail = (message = SIGNUP_FAILED, status: 400 | 429 | 502 = 502): SignupResult => ({ ok: false, message, status });
  const invalid = validateEmail(input.email);
  if (invalid) return fail(invalid, 400);
  if (!apiUrl) return fail();
  try {
    const res = await fetcher(`${apiUrl.replace(/\/+$/, "")}/subscribers`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(input.clientIp ? { "x-forwarded-for": input.clientIp } : {}) },
      body: JSON.stringify({
        email: input.email.trim(),
        ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
        ...(input.hp_url ? { hp_url: input.hp_url } : {}),
      }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) return fail(EMAIL_INVALID, 400);
    if (res.status === 429) return fail(SIGNUP_RATE_LIMITED, 429);
    return fail();
  } catch {
    return fail();
  }
}
