import { Hono } from "hono";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { blogPosts, type CapsuleDb } from "@kcom/db";
import {
  assertCanChange,
  findById,
  httpUrl,
  idParam,
  notFound,
  pagination,
  publishStatus,
  rethrowWriteError,
  richTextSchema,
} from "../content/index.js";
import { assertCan, requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const text = (max: number) => z.string().trim().max(max);

const fields = {
  title: text(200).min(1),
  slug,
  date: z.iso.date(),
  excerpt: text(500).min(1).nullable(),
  body: richTextSchema,
  heroImageUrl: httpUrl.max(2000).nullable(),
  tags: z.array(text(50).min(1)).max(20),
  authorId: z.uuid().nullable(),
  status: publishStatus,
  publishAt: z.coerce.date().nullable(),
};

const createBody = z.strictObject({
  ...fields,
  excerpt: fields.excerpt.default(null),
  heroImageUrl: fields.heroImageUrl.default(null),
  tags: fields.tags.default([]),
  authorId: fields.authorId.default(null),
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.default(null),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const listQuery = z.object({ status: fields.status.optional(), ...pagination() });

const BLOG_ERRORS = {
  label: "post slug",
  messages: { reference: "author does not exist" },
};

/** Editor/admin endpoints: full access to blog posts including drafts and scheduled ones. */
export function adminBlogRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  const byId = (id: string) => findById(db, blogPosts, id, "post");

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const where = status ? eq(blogPosts.status, status) : undefined;
      const [items, [counted]] = await Promise.all([
        db
          .select()
          .from(blogPosts)
          .where(where)
          .orderBy(desc(blogPosts.date), desc(blogPosts.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(blogPosts).where(where),
      ]);
      return c.json({ items, total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await byId(c.req.valid("param").id)),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const body = c.req.valid("json");
      assertCanChange(c, null, body.status);
      if (body.publishAt !== null) assertCan(c, "content:publish");
      try {
        const [row] = await db.insert(blogPosts).values(body).returning();
        return c.json(row!, 201);
      } catch (err) {
        rethrowWriteError(err, BLOG_ERRORS);
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const existing = await byId(id);
      assertCanChange(c, existing.status, patch.status);
      if (patch.publishAt !== undefined) assertCan(c, "content:publish");
      try {
        const [row] = await db.update(blogPosts).set(patch).where(eq(blogPosts.id, id)).returning();
        return c.json(row!);
      } catch (err) {
        rethrowWriteError(err, BLOG_ERRORS);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      assertCanChange(c, (await byId(id)).status);
      const rows = await db
        .delete(blogPosts)
        .where(eq(blogPosts.id, id))
        .returning({ id: blogPosts.id });
      if (rows.length === 0) throw notFound("post");
      return c.body(null, 204);
    });
}
