import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { blogPosts, type CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";
import {
  conflictOnDuplicateSlug,
  httpUrl,
  idParam,
  isLive,
  notFound,
  publishStatus,
  requirePublishRight,
  richText,
  slugParam,
} from "./publishing.js";

const fields = {
  title: z.string().min(1),
  slug,
  date: z.iso.date(),
  excerpt: z.string().nullable(),
  body: richText,
  heroImageUrl: httpUrl.nullable(),
  tags: z.array(z.string().min(1)),
  authorId: z.uuid().nullable(),
  status: publishStatus,
  publishAt: z.iso.datetime({ offset: true }).nullable(),
};
const createSchema = z
  .object(fields)
  .partial()
  .required({ title: true, slug: true, date: true, body: true });
const updateSchema = z.object(fields).partial();

type Input = z.infer<typeof updateSchema>;
const toRow = ({ publishAt, ...rest }: Input) => ({
  ...rest,
  ...(publishAt === undefined
    ? {}
    : { publishAt: publishAt === null ? null : new Date(publishAt) }),
});

/** Public reads: published posts only. */
export function blogRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/", async (c) => {
      const rows = await db
        .select()
        .from(blogPosts)
        .where(isLive(blogPosts))
        .orderBy(desc(blogPosts.date), desc(blogPosts.createdAt));
      c.header("Cache-Control", "public, max-age=60");
      return c.json(rows);
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, c.req.valid("param").slug), isLive(blogPosts)))
        .limit(1);
      if (!row) notFound("post");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(row);
    });
}

/** Editor CRUD: every post, drafts included. */
export function adminBlogRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>()
    .get("/", requirePermission(auth, "content:read"), async (c) =>
      c.json(
        await db.select().from(blogPosts).orderBy(desc(blogPosts.date), desc(blogPosts.createdAt)),
      ),
    )
    .get("/:id", requirePermission(auth, "content:read"), validate("param", idParam), async (c) => {
      const [row] = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.id, c.req.valid("param").id));
      return row ? c.json(row) : notFound("post");
    })
    .post(
      "/",
      requirePermission(auth, "content:write"),
      validate("json", createSchema),
      async (c) => {
        const body = c.req.valid("json");
        requirePublishRight(c.var.user, body.status);
        const [row] = await db
          .insert(blogPosts)
          .values({
            ...toRow(body),
            title: body.title,
            slug: body.slug,
            date: body.date,
            body: body.body,
          })
          .returning()
          .catch(conflictOnDuplicateSlug);
        return c.json(row!, 201);
      },
    )
    .patch(
      "/:id",
      requirePermission(auth, "content:write"),
      validate("param", idParam),
      validate("json", updateSchema),
      async (c) => {
        const body = c.req.valid("json");
        requirePublishRight(c.var.user, body.status);
        const [row] = await db
          .update(blogPosts)
          .set(toRow(body))
          .where(eq(blogPosts.id, c.req.valid("param").id))
          .returning()
          .catch(conflictOnDuplicateSlug);
        return row ? c.json(row) : notFound("post");
      },
    )
    .delete(
      "/:id",
      requirePermission(auth, "content:write"),
      validate("param", idParam),
      async (c) => {
        const [row] = await db
          .delete(blogPosts)
          .where(eq(blogPosts.id, c.req.valid("param").id))
          .returning({ id: blogPosts.id });
        return row ? c.body(null, 204) : notFound("post");
      },
    );
}
