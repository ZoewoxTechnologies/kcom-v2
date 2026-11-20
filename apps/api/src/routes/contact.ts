import { Hono } from "hono";
import { z } from "zod";
import { contactMessages, type CapsuleDb } from "@kcom/db";
import { contactTopics } from "@kcom/db/contact-topics";
import { validate } from "../validate.js";


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
});

export const contactRoutes = (db: CapsuleDb) =>
  new Hono().post("/", validate("json", body), async (c) => {
    const [row] = await db
      .insert(contactMessages)
      .values(c.req.valid("json"))
      .returning({ id: contactMessages.id });
    return c.json({ id: row!.id }, 201);
  });
