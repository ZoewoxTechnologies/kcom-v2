import { Hono } from "hono";
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { events, type CapsuleDb } from "@kcom/db";
import {
  assertCanChange,
  findById,
  httpUrl,
  idParam,
  notFound,
  pagination,
  publicCache,
  rethrowWriteError,
  richTextSchema,
  slugParam,
} from "../content/index.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

/** Events have no publish time, so they are only draft or published. */
const eventStatus = z.enum(["draft", "published"]);

const fields = {
  title: z.string().trim().min(1).max(200),
  slug,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  place: z.string().trim().min(1).max(300).nullable(),
  description: richTextSchema.nullable(),
  imageUrl: httpUrl.nullable(),
  status: eventStatus,
};

const createBody = z
  .strictObject({
    ...fields,
    endsAt: fields.endsAt.default(null),
    place: fields.place.default(null),
    description: fields.description.default(null),
    imageUrl: fields.imageUrl.default(null),
    status: fields.status.default("draft"),
  })
  .refine((b) => !b.endsAt || b.endsAt >= b.startsAt, {
    path: ["endsAt"],
    message: "must not be before startsAt",
  });
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const listQuery = z.object({ status: eventStatus.optional(), ...pagination() });
const publicQuery = z.object({ ...pagination(100) });

const EVENT_ERRORS = { label: "event slug" };
const published = eq(events.status, "published");

/** Public, read-only: published events only, split into upcoming and past. */
export function eventRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", validate("query", publicQuery), async (c) => {
      const { limit, offset } = c.req.valid("query");
      const [upcoming, past] = await Promise.all([
        db
          .select()
          .from(events)
          .where(and(published, gte(events.startsAt, sql`now()`)))
          .orderBy(asc(events.startsAt))
          .limit(limit)
          .offset(offset),
        db
          .select()
          .from(events)
          .where(and(published, lt(events.startsAt, sql`now()`)))
          .orderBy(desc(events.startsAt))
          .limit(limit)
          .offset(offset),
      ]);
      return c.json({ upcoming, past });
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(events)
        .where(and(published, eq(events.slug, c.req.valid("param").slug)))
        .limit(1);
      if (!row) throw notFound("event");
      return c.json(row);
    });
}

/** Editor/admin endpoints: full access to events including drafts. */
export function adminEventRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  const byId = (id: string) => findById(db, events, id, "event");

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const where = status ? eq(events.status, status) : undefined;
      const [items, [counted]] = await Promise.all([
        db
          .select()
          .from(events)
          .where(where)
          .orderBy(desc(events.startsAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(events).where(where),
      ]);
      return c.json({ items, total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await byId(c.req.valid("param").id)),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const body = c.req.valid("json");
      assertCanChange(c, null, body.status);
      try {
        const [row] = await db.insert(events).values(body).returning();
        return c.json(row!, 201);
      } catch (err) {
        rethrowWriteError(err, EVENT_ERRORS);
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const existing = await byId(id);
      assertCanChange(c, existing.status, patch.status);
      try {
        const [row] = await db.update(events).set(patch).where(eq(events.id, id)).returning();
        return c.json(row!);
      } catch (err) {
        rethrowWriteError(err, EVENT_ERRORS);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      assertCanChange(c, (await byId(id)).status);
      await db.delete(events).where(eq(events.id, id));
      return c.body(null, 204);
    });
}
