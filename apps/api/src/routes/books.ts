import { Hono } from "hono";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { books, isLive, type CapsuleDb } from "@kcom/db";
import {
  assertCanChange,
  findById,
  httpUrl,
  idParam,
  notFound,
  pagination,
  publicCache,
  publishStatus,
  rethrowWriteError,
  richTextSchema,
  slugParam,
} from "../content/index.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const fields = {
  title: z.string().trim().min(1).max(200),
  slug,
  description: richTextSchema.nullable(),
  coverUrl: httpUrl.max(2000).nullable(),
  purchaseUrl: httpUrl.max(2000).nullable(),
  publishedYear: z.number().int().min(1000).max(9999).nullable(),
  authorId: z.uuid().nullable(),
  status: publishStatus,
  publishAt: z.coerce.date().nullable(),
};

const createBody = z.strictObject({
  ...fields,
  description: fields.description.default(null),
  coverUrl: fields.coverUrl.default(null),
  purchaseUrl: fields.purchaseUrl.default(null),
  publishedYear: fields.publishedYear.default(null),
  authorId: fields.authorId.default(null),
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.default(null),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");
const listQuery = z.object({ status: fields.status.optional(), ...pagination() });
const publicQuery = z.object(pagination());

const BOOK_ERRORS = { label: "book slug", messages: { reference: "author does not exist" } };

/** Public, read-only: published books whose publish time has passed. */
export function publicBookRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", validate("query", publicQuery), async (c) => {
      const { limit, offset } = c.req.valid("query");
      return c.json(
        await db
          .select()
          .from(books)
          .where(isLive(books))
          .orderBy(asc(books.title))
          .limit(limit)
          .offset(offset),
      );
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(books)
        .where(and(eq(books.slug, c.req.valid("param").slug), isLive(books)))
        .limit(1);
      if (!row) throw notFound("book");
      return c.json(row);
    });
}

/** Mounted under the /admin group, which already enforces sign-in and role. */
export function adminBookRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  const byId = (id: string) => findById(db, books, id, "book");
  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const where = status ? eq(books.status, status) : undefined;
      const [items, [counted]] = await Promise.all([
        db.select().from(books).where(where).orderBy(asc(books.title)).limit(limit).offset(offset),
        db.select({ total: count() }).from(books).where(where),
      ]);
      return c.json({ items, total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await byId(c.req.valid("param").id)),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const body = c.req.valid("json");
      assertCanChange(c, null, body.status);
      try {
        const [row] = await db.insert(books).values(body).returning();
        return c.json(row!, 201);
      } catch (err) {
        rethrowWriteError(err, BOOK_ERRORS);
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const existing = await byId(id);
      assertCanChange(c, existing.status, patch.status);
      try {
        const [row] = await db.update(books).set(patch).where(eq(books.id, id)).returning();
        return c.json(row!);
      } catch (err) {
        rethrowWriteError(err, BOOK_ERRORS);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      assertCanChange(c, (await byId(id)).status);
      const rows = await db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
      if (rows.length === 0) throw notFound("book");
      return c.body(null, 204);
    });
}
