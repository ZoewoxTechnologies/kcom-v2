import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { blogPosts, isLive, type CapsuleDb } from "@kcom/db";
import { notFound, pagination, publicCache, slugParam } from "../content/index.js";
import { validate } from "../validate.js";
import { z } from "zod";

const listQuery = z.object(pagination());

/** Public, read-only: only published posts whose publish time has passed. */
export function blogRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", validate("query", listQuery), async (c) => {
      const { limit, offset } = c.req.valid("query");
      const rows = await db
        .select()
        .from(blogPosts)
        .where(isLive(blogPosts))
        .orderBy(desc(blogPosts.date), desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset);
      return c.json(rows);
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, c.req.valid("param").slug), isLive(blogPosts)))
        .limit(1);
      if (!row) throw notFound("post");
      return c.json(row);
    });
}
