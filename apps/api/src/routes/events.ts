import { Hono } from "hono";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { events, type CapsuleDb } from "@kcom/db";
import {
  adminCrudRoutes,
  httpUrl,
  notFound,
  pagination,
  publicCache,
  richTextSchema,
  slugParam,
} from "../content/index.js";
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

const publicQuery = z.object({ ...pagination(100) });

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
export const adminEventRoutes = (db: CapsuleDb) =>
  adminCrudRoutes({
    db,
    table: events,
    label: "event",
    createBody,
    updateBody,
    orderBy: [desc(events.startsAt)],
  });
