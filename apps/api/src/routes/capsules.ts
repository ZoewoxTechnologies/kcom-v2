import { Hono } from "hono";
import { z } from "zod";
import { and, eq, lte, sql } from "drizzle-orm";
import { capsules, latestCapsule, type CapsuleDb } from "@kcom/db";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";

const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });

export function capsuleRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/latest", async (c) => {
      const capsule = await latestCapsule(db);
      if (!capsule) throw new HttpError(404, "not_found", "not found");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(capsule);
    })
    // Sample of the route pattern: validate input, query the db, return a typed body.
    .get("/:slug", validate("param", slugParam), async (c) => {
      const { slug } = c.req.valid("param");
      const [capsule] = await db
        .select()
        .from(capsules)
        .where(
          and(
            eq(capsules.slug, slug),
            eq(capsules.status, "published"),
            lte(capsules.date, sql`current_date`),
          ),
        )
        .limit(1);
      if (!capsule) throw new HttpError(404, "not_found", "capsule not found");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(capsule);
    });
}
