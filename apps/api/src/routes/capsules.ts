import { Hono } from "hono";
import { z } from "zod";
import { lagosDate, lagosDayRange, lagosMonthRange, slug } from "@kcom/content";
import {
  capsuleByRange,
  capsuleNeighbours,
  capsuleBySlug,
  earliestCapsule,
  latestCapsule,
  listPublishedCapsules,
  type CapsuleDb,
} from "@kcom/db";
import { notFound, pagination, publicCache, slugParam } from "../content/index.js";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";

const dateParam = z.object({ date: z.iso.date() });

const listQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM")
    .optional(),
  date: z.iso.date().optional(),
  series: slug.optional(),
  ...pagination(30),
});

type Capsule = NonNullable<Awaited<ReturnType<typeof latestCapsule>>>;

/** The capsule's day is its publish_at in Africa/Lagos, not UTC. */
export const present = (capsule: Capsule) => ({
  ...capsule,
  displayDate: lagosDate(capsule.publishAt),
});

/** Public, read-only: only published capsules whose publish time has passed. */
export function capsuleRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", validate("query", listQuery), async (c) => {
      const q = c.req.valid("query");
      if (q.month && q.date) {
        throw new HttpError(400, "invalid_request", "use either month or date, not both");
      }
      const [from, to] = q.date ? lagosDayRange(q.date) : q.month ? lagosMonthRange(q.month) : [];
      const rows = await listPublishedCapsules(db, {
        from,
        to,
        seriesSlug: q.series,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json(rows.map(present));
    })
    .get("/latest", async (c) => {
      const capsule = await latestCapsule(db);
      if (!capsule) throw notFound("capsule");
      return c.json(present(capsule));
    })
    .get("/earliest", async (c) => {
      const capsule = await earliestCapsule(db);
      if (!capsule) throw notFound("capsule");
      return c.json(present(capsule));
    })
    .get("/date/:date", validate("param", dateParam), async (c) => {
      const capsule = await capsuleByRange(db, ...lagosDayRange(c.req.valid("param").date));
      if (!capsule) throw notFound("capsule");
      return c.json(present(capsule));
    })
    .get("/:slug/neighbours", validate("param", slugParam), async (c) => {
      const capsule = await capsuleBySlug(db, c.req.valid("param").slug);
      if (!capsule) throw notFound("capsule");
      const { prev, next } = await capsuleNeighbours(db, capsule);
      const link = (row: Capsule | null) => {
        if (!row) return null;
        const { slug, title, scriptureRef } = row;
        return { slug, title, scriptureRef, displayDate: lagosDate(row.publishAt) };
      };
      return c.json({ prev: link(prev), next: link(next) });
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const capsule = await capsuleBySlug(db, c.req.valid("param").slug);
      if (!capsule) throw notFound("capsule");
      return c.json(present(capsule));
    });
}
