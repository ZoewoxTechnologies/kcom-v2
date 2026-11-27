import { Hono } from "hono";
import { z } from "zod";
import { contactMessages, type CapsuleDb } from "@kcom/db";
import { contactTopics } from "@kcom/db/contact-topics";
import { validate } from "../validate.js";
import { DEFAULT_TRUSTED_PROXY_HOPS, requestClientIp } from "../client-ip.js";
import type { Mailer } from "../mailer.js";
import { overRateLimit } from "../contact-spam.js";

// Mirrors the web form's rules (apps/web/src/lib/contact.ts), plus length caps.
const body = z.strictObject({
  topic: z.enum(contactTopics),
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name.")
    .max(200, "Please keep your name under 200 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .max(320, "That email address is too long.")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a full email address."),
  message: z
    .string()
    .trim()
    .min(1, "Please write a message.")
    .max(10000, "Please keep your message under 10,000 characters."),
  keepPrivate: z.boolean().default(false),
  /** Honeypot: hidden on the form, so only bots fill it. */
  hp_url: z.string().max(2000).optional(),
  /** Token from the form's bot check, handed to the configured BotCheck. */
  botToken: z.string().max(4000).optional(),
});

/**
 * Decides whether a submission comes from a person. This is where a bot check
 * plugs in: it gets the token the form sent as `botToken` and the client IP,
 * and returns false to reject. With none configured every submission passes.
 */
export type BotCheck = (input: { token?: string; ip?: string }) => boolean | Promise<boolean>;

export const contactRoutes = (
  db: CapsuleDb,
  trustedProxyHops = DEFAULT_TRUSTED_PROXY_HOPS,
  botCheck?: BotCheck,
  mailer?: Mailer,
) =>
  new Hono()
    // Honeypot first, before validation, so a bot cannot tell it was caught.
    .use(async (c, next) => {
      const raw = (await c.req.json().catch(() => null)) as { hp_url?: unknown } | null;
      if (typeof raw?.hp_url === "string" && raw.hp_url.length > 0) {
        console.warn("[contact] honeypot triggered; message discarded");
        return c.json({ id: crypto.randomUUID() }, 201);
      }
      await next();
    })
    .post("/", validate("json", body), async (c) => {
      const { topic, name, email, message: text, keepPrivate, botToken } = c.req.valid("json");
      const ip = requestClientIp(c, trustedProxyHops);
      if (!ip)
        console.warn("[contact] no client IP available; rate limit skipped for this request");
      if (ip && (await overRateLimit(db, ip))) {
        console.warn(`[contact] rate limit exceeded (ip: ${ip})`);
        return c.json(
          {
            error: {
              code: "rate_limited",
              message: "You have sent too many messages recently. Please try again later.",
            },
          },
          429,
        );
      }
      if (botCheck && !(await botCheck({ token: botToken, ip }))) {
        console.warn("[contact] bot check failed; message discarded");
        return c.json(
          {
            error: {
              code: "verification_failed",
              message: "We could not verify that you are human. Please try again.",
            },
          },
          400,
        );
      }
      const [row] = await db
        .insert(contactMessages)
        .values({ topic, name, email, message: text, keepPrivate })
        .returning({ id: contactMessages.id });
      // The message is saved; a failed alert must not turn that into an error.
      if (mailer)
        await mailer.sendContactAlert({ topic, name, email, message: text }).catch((err) => {
          console.error("[contact] notification email failed:", err);
        });
      return c.json({ id: row!.id }, 201);
    });
