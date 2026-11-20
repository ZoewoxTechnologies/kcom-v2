import { Hono } from "hono";
import { z } from "zod";
import { contactMessages, type CapsuleDb } from "@kcom/db";
import { contactTopics } from "@kcom/db/contact-topics";
import { validate } from "../validate.js";
import { clientIp, overRateLimit, verifyRecaptcha, type RecaptchaOptions } from "../contact-spam.js";


// Mirrors the web form's rules (apps/web/src/lib/contact.ts), plus length caps.
const body = z.strictObject({
  topic: z.enum(contactTopics),
  name: z.string().trim().min(1, "Please enter your name.").max(200, "Please keep your name under 200 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .max(320, "That email address is too long.")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a full email address."),
  message: z.string().trim().min(1, "Please write a message.").max(10000, "Please keep your message under 10,000 characters."),
  keepPrivate: z.boolean().default(false),
  /** Honeypot: hidden on the form, so only bots fill it. */
  website: z.string().max(2000).optional(),
  recaptchaToken: z.string().max(4000).optional(),
});

export const contactRoutes = (db: CapsuleDb, recaptcha: RecaptchaOptions = {}) =>
  new Hono()
    // Honeypot first, before validation, so a bot cannot tell it was caught.
    .use(async (c, next) => {
      const raw = (await c.req.json().catch(() => null)) as { website?: unknown } | null;
      if (typeof raw?.website === "string" && raw.website.length > 0) {
        console.warn("[contact] honeypot triggered; message discarded");
        return c.json({ id: crypto.randomUUID() }, 201);
      }
      await next();
    })
    .post("/", validate("json", body), async (c) => {
      const { recaptchaToken, topic, name, email, message: text, keepPrivate } = c.req.valid("json");
      const ip = clientIp(c.req.header("x-forwarded-for"));
      if (await overRateLimit(db, ip)) {
        console.warn(`[contact] rate limit exceeded (ip: ${ip})`);
        return c.json({ error: { code: "rate_limited", message: "You have sent too many messages recently. Please try again later." } }, 429);
      }
      const verdict = await verifyRecaptcha(recaptchaToken, recaptcha);
      if (!verdict.ok) {
        console.warn(`[contact] reCAPTCHA rejected (${verdict.reason})`);
        return c.json({ error: { code: "recaptcha_failed", message: "We couldn't verify your submission. Please try again." } }, 403);
      }
      const [row] = await db.insert(contactMessages).values({ topic, name, email, message: text, keepPrivate }).returning({ id: contactMessages.id });
      return c.json({ id: row!.id }, 201);
    });
