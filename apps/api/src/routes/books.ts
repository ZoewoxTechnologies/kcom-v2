import { Hono } from "hono";
import { z } from "zod";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { slug } from "@kcom/content";
import { books, people, publishStatus, type CapsuleDb } from "@kcom/db";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";

const idParam = z.object({ id: z.uuid() });
const slugParam = z.object({ slug });

const httpUrl = z.url().refine((u) => /^https?:\/\//.test(u), "must be an http(s) URL");

const bookInput = z.object({
  title: z.string().trim().min(1),
  slug,
  description: z.record(z.string(), z.unknown()).nullable().default(null),
  coverUrl: httpUrl.nullable().default(null),
  purchaseUrl: httpUrl.nullable().default(null),
  publishedYear: z.number().int().min(1000).max(9999).nullable().default(null),
  authorId: z.uuid().nullable().default(null),
  status: z.enum(publishStatus.enumValues).default("draft"),
  publishAt: z.coerce.date().nullable().default(null),
});
const bookPatch = bookInput.partial();

/** Published and not scheduled for the future. */
const visible = and(
  eq(books.status, "published"),
  or(isNull(books.publishAt), lte(books.publishAt, sql`now()`)),
);

export function publicBookRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/", async (c) => {
      const rows = await db.select().from(books).where(visible).orderBy(asc(books.title));
      c.header("Cache-Control", "public, max-age=60");
      return c.json(rows);
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(books)
        .where(and(eq(books.slug, c.req.valid("param").slug), visible))
        .limit(1);
      if (!row) throw new HttpError(404, "not_found", "book not found");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(row);
    });
}

async function assertRefs(
  db: CapsuleDb,
  input: { slug?: string; authorId?: string | null },
  selfId?: string,
) {
  if (input.slug !== undefined) {
    const [dup] = await db.select({ id: books.id }).from(books).where(eq(books.slug, input.slug));
    if (dup && dup.id !== selfId) throw new HttpError(409, "conflict", "slug already in use");
  }
  if (input.authorId) {
    const [author] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, input.authorId));
    if (!author) throw new HttpError(422, "invalid_author", "author does not exist");
  }
}

/** Mounted under the /admin group, which already enforces sign-in and role. */
export function adminBookRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/", async (c) => c.json(await db.select().from(books).orderBy(asc(books.title))))
    .get("/:id", validate("param", idParam), async (c) => {
      const [row] = await db
        .select()
        .from(books)
        .where(eq(books.id, c.req.valid("param").id));
      if (!row) throw new HttpError(404, "not_found", "book not found");
      return c.json(row);
    })
    .post("/", validate("json", bookInput), async (c) => {
      const input = c.req.valid("json");
      await assertRefs(db, input);
      const [row] = await db.insert(books).values(input).returning();
      return c.json(row, 201);
    })
    .patch("/:id", validate("param", idParam), validate("json", bookPatch), async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      await assertRefs(db, input, id);
      const [row] = await db.update(books).set(input).where(eq(books.id, id)).returning();
      if (!row) throw new HttpError(404, "not_found", "book not found");
      return c.json(row);
    })
    .delete("/:id", validate("param", idParam), async (c) => {
      const [row] = await db
        .delete(books)
        .where(eq(books.id, c.req.valid("param").id))
        .returning({ id: books.id });
      if (!row) throw new HttpError(404, "not_found", "book not found");
      return c.body(null, 204);
    });
}
