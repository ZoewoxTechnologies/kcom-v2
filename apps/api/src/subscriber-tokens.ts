import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenPurpose = "confirm" | "unsubscribe";

const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

/**
 * Signed link token for a subscriber: `<id>.<expiresAt>.<signature>`. Confirm tokens expire;
 * unsubscribe tokens do not, so an old email can always opt out.
 */
export function signSubscriberToken(
  secret: string,
  purpose: TokenPurpose,
  id: string,
  now = Date.now(),
): string {
  const expires = purpose === "confirm" ? now + CONFIRM_TTL_MS : 0;
  const payload = `${id}.${expires}`;
  return `${payload}.${sign(secret, `${purpose}.${payload}`)}`;
}

/** The subscriber id when the token is genuine, for this purpose and unexpired; otherwise null. */
export function verifySubscriberToken(
  secret: string,
  purpose: TokenPurpose,
  token: string,
  now = Date.now(),
): string | null {
  const [id, expires, signature, ...rest] = token.split(".");
  if (!id || !expires || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(secret, `${purpose}.${id}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (purpose === "confirm" && !(Number(expires) > now)) return null;
  return id;
}
