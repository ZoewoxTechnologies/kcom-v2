import { Hono } from "hono";
import { z } from "zod";
import { lagosDate, slug } from "@kcom/content";
import {
  capsuleByRange,
  capsuleBySlug,
  latestCapsule,
  listPublishedCapsules,
  type CapsuleDb,
} from "@kcom/db";
import { notFound, pagination, slugParam } from "../content/index.js";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";

const dateParam = z.object({ date: z.iso.date() });

const LAGOS = "+01:00"; // Africa/Lagos has no daylight saving.
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** [from, to) instants covering one Lagos calendar day. */
export const dayRange = (date: string) => {
  const from = new Date(`${date}T00:00:00${LAGOS}`);
  return [from, new Date(from.getTime() + DAY_MS)] as const;
};

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return [
    new Date(`${month}-01T00:00:00${LAGOS}`),
    new Date(`${next}-01T00:00:00${LAGOS}`),
  ] as const;
}

/** Public, read-only: only published capsules whose publish time has passed. */
export function capsuleRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/", validate("query", listQuery), async (c) => {
      const q = c.req.valid("query");
      if (q.month && q.date) {
        throw new HttpError(400, "invalid_request", "use either month or date, not both");
      }
      const [from, to] = q.date ? dayRange(q.date) : q.month ? monthRange(q.month) : [];
      const rows = await listPublishedCapsules(db, {
        from,
        to,
        seriesSlug: q.series,
        limit: q.limit,
        offset: q.offset,
      });
      c.header("Cache-Control", "public, max-age=60");
      return c.json(rows.map(present));
    })
    .get("/latest", async (c) => {
      const capsule = await latestCapsule(db);
      if (!capsule) throw new HttpError(404, "not_found", "not found");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(present(capsule));
    })
    .get("/date/:date", validate("param", dateParam), async (c) => {
      const capsule = await capsuleByRange(db, ...dayRange(c.req.valid("param").date));
      if (!capsule) throw notFound("capsule");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(present(capsule));
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const capsule = await capsuleBySlug(db, c.req.valid("param").slug);
      if (!capsule) throw notFound("capsule");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(present(capsule));
    });
}
