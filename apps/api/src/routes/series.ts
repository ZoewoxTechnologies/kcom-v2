import { Hono } from "hono";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { lagosDate, slug } from "@kcom/content";
import { capsules, listLiveSeries, liveSeriesBySlug, series, type CapsuleDb } from "@kcom/db";
import {
  findById,
  idParam,
  notFound,
  pagination,
  publicCache,
  rethrowWriteError,
  slugParam,
} from "../content/index.js";
import { logActivity } from "../activity.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const fields = {
  title: z.string().trim().min(1).max(200),
  slug,
  description: z.string().trim().min(1).max(2000).nullable(),
};
const createBody = z.strictObject({ ...fields, description: fields.description.default(null) });
const updateBody = z
  .strictObject({
    title: fields.title.optional(),
    slug: fields.slug.optional(),
    description: fields.description.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const listQuery = z.object(pagination());

type LiveSeries = NonNullable<Awaited<ReturnType<typeof liveSeriesBySlug>>>;

/** Series fields plus its live-capsule summary; days are Africa/Lagos calendar days. */
const present = ({
  capsuleCount,
  firstPublishAt,
  lastPublishAt,
  latestPart,
  ...row
}: LiveSeries) => ({
  ...row,
  capsuleCount,
  firstDate: lagosDate(firstPublishAt!),
  lastDate: lagosDate(lastPublishAt!),
  latestPart,
});

/** Public, read-only: only series that have at least one live capsule. */
export function seriesRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", async (c) => c.json((await listLiveSeries(db)).map(present)))
    .get("/:slug", validate("param", slugParam), async (c) => {
      const row = await liveSeriesBySlug(db, c.req.valid("param").slug);
      if (!row) throw notFound("series");
      return c.json(present(row));
    });
}

export function adminSeriesRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { limit, offset } = c.req.valid("query");
      const [items, [counted]] = await Promise.all([
        db.select().from(series).orderBy(asc(series.title)).limit(limit).offset(offset),
        db.select({ total: count() }).from(series),
      ]);
      return c.json({ items, total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await findById(db, series, c.req.valid("param").id, "series")),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      try {
        const [row] = await db.insert(series).values(c.req.valid("json")).returning();
        await logActivity(db, c, {
          action: "create",
          entityType: "series",
          entityId: row!.id,
          title: row!.title,
        });
        return c.json(row!, 201);
      } catch (err) {
        rethrowWriteError(err, { label: "series slug" });
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      await findById(db, series, id, "series");
      try {
        const [row] = await db
          .update(series)
          .set(c.req.valid("json"))
          .where(eq(series.id, id))
          .returning();
        await logActivity(db, c, {
          action: "update",
          entityType: "series",
          entityId: id,
          title: row!.title,
        });
        return c.json(row!);
      } catch (err) {
        rethrowWriteError(err, { label: "series slug" });
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const existing = await findById(db, series, id, "series");
      // Capsules keep existing but leave the series; part numbers only make sense inside one.
      const deleted = await db.transaction(async (tx) => {
        await tx.update(capsules).set({ partNumber: null }).where(eq(capsules.seriesId, id));
        return tx.delete(series).where(eq(series.id, id)).returning({ id: series.id });
      });
      if (deleted.length === 0) throw notFound("series");
      await logActivity(db, c, {
        action: "delete",
        entityType: "series",
        entityId: id,
        title: existing.title,
      });
      return c.body(null, 204);
    });
}
