import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { events, type CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { HttpError } from "../errors.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const idParam = z.object({ id: z.uuid() });

const fields = {
  title: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  endsAt: z.iso
    .datetime({ offset: true })
    .transform((v) => new Date(v))
    .nullable(),
  place: z.string().trim().max(300).nullable(),
  description: z.string().max(20000).nullable(),
  imageUrl: z.url().nullable(),
  status: z.enum(["draft", "published"]),
};

const createBody = z
  .object({ ...fields, endsAt: fields.endsAt.optional(), status: fields.status.default("draft") })
  .partial({ place: true, description: true, imageUrl: true })
  .refine((v) => !v.endsAt || v.endsAt >= v.startsAt, {
    path: ["endsAt"],
    message: "must not be before startsAt",
  });

const updateBody = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });

const notFound = () => new HttpError(404, "not_found", "event not found");

/**
 * Public reads (published only) at /events and editor CRUD at /admin/events.
 * Mount at the app root.
 */
export function eventRoutes(db: CapsuleDb, auth: Auth) {
  const published = eq(events.status, "published");
  const guard = (permission: "content:read" | "content:write") =>
    requirePermission(auth, permission);

  const pub = new Hono()
    .get("/", async (c) => {
      const [upcoming, past] = await Promise.all([
        db
          .select()
          .from(events)
          .where(and(published, gte(events.startsAt, sql`now()`)))
          .orderBy(asc(events.startsAt)),
        db
          .select()
          .from(events)
          .where(and(published, lt(events.startsAt, sql`now()`)))
          .orderBy(desc(events.startsAt)),
      ]);
      c.header("Cache-Control", "public, max-age=60");
      return c.json({ upcoming, past });
    })
    .get("/:id", validate("param", idParam), async (c) => {
      const [row] = await db
        .select()
        .from(events)
        .where(and(published, eq(events.id, c.req.valid("param").id)));
      if (!row) throw notFound();
      c.header("Cache-Control", "public, max-age=60");
      return c.json(row);
    });

  const admin = new Hono<AuthEnv>()
    .get("/", guard("content:read"), async (c) =>
      c.json(await db.select().from(events).orderBy(desc(events.startsAt))),
    )
    .get("/:id", guard("content:read"), validate("param", idParam), async (c) => {
      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, c.req.valid("param").id));
      if (!row) throw notFound();
      return c.json(row);
    })
    .post("/", guard("content:write"), validate("json", createBody), async (c) => {
      const [row] = await db.insert(events).values(c.req.valid("json")).returning();
      return c.json(row, 201);
    })
    .patch(
      "/:id",
      guard("content:write"),
      validate("param", idParam),
      validate("json", updateBody),
      async (c) => {
        const [row] = await db
          .update(events)
          .set(c.req.valid("json"))
          .where(eq(events.id, c.req.valid("param").id))
          .returning();
        if (!row) throw notFound();
        return c.json(row);
      },
    )
    .delete("/:id", guard("content:write"), validate("param", idParam), async (c) => {
      const [row] = await db
        .delete(events)
        .where(eq(events.id, c.req.valid("param").id))
        .returning({ id: events.id });
      if (!row) throw notFound();
      return c.body(null, 204);
    });

  return new Hono().route("/events", pub).route("/admin/events", admin);
}
