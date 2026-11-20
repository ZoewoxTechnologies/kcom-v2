import { Hono } from "hono";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { events, type CapsuleDb } from "@kcom/db";
import {
  adminCrudRoutes,
  cloudinaryImageUrl,
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
  imageUrl: cloudinaryImageUrl.nullable(),
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

const publicQuery = z.object({
  when: z.enum(["upcoming", "past"]).default("upcoming"),
  ...pagination(),
});

const published = eq(events.status, "published");

/**
 * Public, read-only: published events only. Not `publicContentRoutes`: events
 * have no publishAt, and the list is split into upcoming and past.
 */
export function eventRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", validate("query", publicQuery), async (c) => {
      const { when, limit, offset } = c.req.valid("query");
      // An event is upcoming until it ends (or starts, when it has no end time).
      const end = sql`coalesce(${events.endsAt}, ${events.startsAt})`;
      const rows = await db
        .select()
        .from(events)
        .where(and(published, when === "upcoming" ? gte(end, sql`now()`) : lt(end, sql`now()`)))
        .orderBy(when === "upcoming" ? asc(events.startsAt) : desc(events.startsAt))
        .limit(limit)
        .offset(offset);
      return c.json(rows);
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
    errors: { messages: { check: "end time must not be before start time" } },
    createBody,
    updateBody,
    orderBy: [desc(events.startsAt)],
  });
