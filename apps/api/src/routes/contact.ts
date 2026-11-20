import { Hono } from "hono";
import { z } from "zod";
import { contactMessages, type CapsuleDb } from "@kcom/db";
import { validate } from "../validate.js";

export const contactTopics = ["question", "prayer", "testimony", "invitation", "other"] as const;

// Mirrors the web form's rules (apps/web/src/lib/contact.ts), plus length caps.
const body = z.strictObject({
  topic: z.enum(contactTopics),
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .max(320)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a full email address."),
  message: z.string().trim().min(1, "Please write a message.").max(10000),
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
