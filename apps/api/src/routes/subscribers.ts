import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { subscribers, type CapsuleDb } from "@kcom/db";
import { validate } from "../validate.js";
import { DEFAULT_TRUSTED_PROXY_HOPS, requestClientIp } from "../client-ip.js";
import { overLimit } from "../rate-limit.js";
import type { Mailer } from "../mailer.js";
import { signSubscriberToken, verifySubscriberToken } from "../subscriber-tokens.js";
import type { BotCheck } from "./contact.js";

/** Pages on the web site the confirm and unsubscribe links land on. */
const pages = {
  confirmed: "/subscribe/confirmed",
  expired: "/subscribe/expired",
  unsubscribed: "/subscribe/unsubscribed",
} as const;

const IP_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
const EMAIL_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

// Mirrors the web form's email rule (apps/web/src/lib/signup.ts).
const body = z.object({
  email: z
    .string()
    .trim()
    .max(320)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/),
  turnstileToken: z.string().max(4000).optional(),
  /** Honeypot: hidden on the form, so only bots fill it. */
  hp_url: z.string().max(2000).optional(),
});

export type SubscriberRouteOptions = {
  /** Signs confirm and unsubscribe tokens. */
  secret: string;
  /** Public URL of this API: the base of the emailed links. */
  apiUrl: string;
  /** Public URL of the web site: where confirm and unsubscribe links redirect. */
  webUrl: string;
  mailer: Mailer;
  botCheck?: BotCheck;
  trustedProxyHops?: number;
};

export function subscriberRoutes(
  db: CapsuleDb,
  {
    secret,
    apiUrl,
    webUrl,
    mailer,
    botCheck,
    trustedProxyHops = DEFAULT_TRUSTED_PROXY_HOPS,
  }: SubscriberRouteOptions,
) {
  const api = apiUrl.replace(/\/+$/, "");
  const web = webUrl.replace(/\/+$/, "");
  return new Hono()
    .post("/", validate("json", body), async (c) => {
      const { email, turnstileToken, hp_url } = c.req.valid("json");
      // Answers like a real signup so a bot cannot tell it was caught.
      if (hp_url) {
        console.warn("[subscribers] honeypot triggered; signup discarded");
        return c.body(null, 202);
      }
      const ip = requestClientIp(c, trustedProxyHops);
      if (ip && (await overLimit(db, `signup-ip:${ip}`, IP_LIMIT))) {
        console.warn(`[subscribers] rate limit exceeded (ip: ${ip})`);
        return c.json(
          { error: { code: "rate_limited", message: "Too many signups. Try again later." } },
          429,
        );
      }
      if (botCheck && !(await botCheck({ token: turnstileToken, ip }))) {
        console.warn("[subscribers] bot check failed; signup discarded");
        return c.json(
          { error: { code: "verification_failed", message: "Could not verify you are human." } },
          400,
        );
      }
      // Over the per-address limit still answers 202, so the response never depends on the address.
      if (await overLimit(db, `signup-email:${email.toLowerCase()}`, EMAIL_LIMIT))
        return c.body(null, 202);

      const [existing] = await db
        .select({ id: subscribers.id, status: subscribers.status })
        .from(subscribers)
        .where(sql`lower(${subscribers.email}) = ${email.toLowerCase()}`);
      if (existing?.status === "confirmed") return c.body(null, 202);

      const id = existing?.id ?? crypto.randomUUID();
      const token = signSubscriberToken(secret, "confirm", id);
      if (existing) {
        await db
          .update(subscribers)
          .set({
            status: "pending",
            confirmToken: token,
            unsubscribedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(subscribers.id, id));
      } else {
        await db
          .insert(subscribers)
          .values({ id, email, status: "pending", confirmToken: token, source: "website" })
          .onConflictDoNothing();
      }
      try {
        await mailer.sendSubscriberConfirmation(
          email,
          `${api}/subscribers/confirm?token=${encodeURIComponent(token)}`,
          `${api}/subscribers/unsubscribe?token=${encodeURIComponent(signSubscriberToken(secret, "unsubscribe", id))}`,
        );
      } catch (err) {
        console.error("[subscribers] confirmation email failed:", err);
      }
      return c.body(null, 202);
    })
    .get("/confirm", async (c) => {
      const token = c.req.query("token") ?? "";
      const id = verifySubscriberToken(secret, "confirm", token);
      if (!id) return c.redirect(web + pages.expired);
      const [row] = await db
        .select({ status: subscribers.status, confirmToken: subscribers.confirmToken })
        .from(subscribers)
        .where(eq(subscribers.id, id));
      if (row?.status === "confirmed") return c.redirect(web + pages.confirmed);
      // Only the newest emailed token works; a later signup or unsubscribe replaces or clears it.
      if (!row || row.status !== "pending" || row.confirmToken !== token)
        return c.redirect(web + pages.expired);
      await db
        .update(subscribers)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmToken: null,
          updatedAt: new Date(),
        })
        .where(eq(subscribers.id, id));
      return c.redirect(web + pages.confirmed);
    })
    .get("/unsubscribe", async (c) => {
      const id = verifySubscriberToken(secret, "unsubscribe", c.req.query("token") ?? "");
      if (!id) return c.redirect(web + pages.expired);
      const [row] = await db
        .update(subscribers)
        .set({
          status: "unsubscribed",
          unsubscribedAt: new Date(),
          confirmToken: null,
          updatedAt: new Date(),
        })
        .where(eq(subscribers.id, id))
        .returning({ id: subscribers.id });
      return c.redirect(web + (row ? pages.unsubscribed : pages.expired));
    });
}
