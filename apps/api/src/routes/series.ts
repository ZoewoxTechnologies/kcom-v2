import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { capsules, listLiveSeries, liveSeriesBySlug, series, type CapsuleDb } from "@kcom/db";
import {
  findById,
  idParam,
  notFound,
  publicCache,
  rethrowWriteError,
  slugParam,
} from "../content/index.js";
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

/** Public, read-only: only series that have at least one live capsule. */
export function seriesRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", async (c) => c.json(await listLiveSeries(db)))
    .get("/:slug", validate("param", slugParam), async (c) => {
      const row = await liveSeriesBySlug(db, c.req.valid("param").slug);
      if (!row) throw notFound("series");
      return c.json(row);
    });
}

export function adminSeriesRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  return new Hono<AuthEnv>()
    .get("/", async (c) => c.json(await db.select().from(series).orderBy(asc(series.title))))
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await findById(db, series, c.req.valid("param").id, "series")),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      try {
        const [row] = await db.insert(series).values(c.req.valid("json")).returning();
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
        return c.json(row!);
      } catch (err) {
        rethrowWriteError(err, { label: "series slug" });
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      // Capsules keep existing but leave the series; part numbers only make sense inside one.
      const deleted = await db.transaction(async (tx) => {
        await tx.update(capsules).set({ partNumber: null }).where(eq(capsules.seriesId, id));
        return tx.delete(series).where(eq(series.id, id)).returning({ id: series.id });
      });
      if (deleted.length === 0) throw notFound("series");
      return c.body(null, 204);
    });
}
