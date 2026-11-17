import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { books, type CapsuleDb } from "@kcom/db";
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
  description: richText.nullable(),
  coverUrl: httpUrl.nullable(),
  purchaseUrl: httpUrl.nullable(),
  publishedYear: z.number().int().min(1000).max(9999).nullable(),
  authorId: z.uuid().nullable(),
  status: publishStatus,
  publishAt: z.iso.datetime({ offset: true }).nullable(),
};
const createSchema = z.object(fields).partial().required({ title: true, slug: true });
const updateSchema = z.object(fields).partial();

type Input = z.infer<typeof updateSchema>;
const toRow = ({ publishAt, ...rest }: Input) => ({
  ...rest,
  ...(publishAt === undefined
    ? {}
    : { publishAt: publishAt === null ? null : new Date(publishAt) }),
});

/** Public reads: published books only. */
export function bookRoutes(db: CapsuleDb) {
  return new Hono()
    .get("/", async (c) => {
      const rows = await db.select().from(books).where(isLive(books)).orderBy(books.title);
      c.header("Cache-Control", "public, max-age=60");
      return c.json(rows);
    })
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [row] = await db
        .select()
        .from(books)
        .where(and(eq(books.slug, c.req.valid("param").slug), isLive(books)))
        .limit(1);
      if (!row) notFound("book");
      c.header("Cache-Control", "public, max-age=60");
      return c.json(row);
    });
}

/** Editor CRUD: every post, drafts included. */
export function adminBookRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>()
    .get("/", requirePermission(auth, "content:read"), async (c) =>
      c.json(await db.select().from(books).orderBy(books.title)),
    )
    .get("/:id", requirePermission(auth, "content:read"), validate("param", idParam), async (c) => {
      const [row] = await db
        .select()
        .from(books)
        .where(eq(books.id, c.req.valid("param").id));
      return row ? c.json(row) : notFound("book");
    })
    .post(
      "/",
      requirePermission(auth, "content:write"),
      validate("json", createSchema),
      async (c) => {
        const body = c.req.valid("json");
        requirePublishRight(c.var.user, body.status);
        const [row] = await db
          .insert(books)
          .values({ ...toRow(body), title: body.title, slug: body.slug })
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
          .update(books)
          .set(toRow(body))
          .where(eq(books.id, c.req.valid("param").id))
          .returning()
          .catch(conflictOnDuplicateSlug);
        return row ? c.json(row) : notFound("book");
      },
    )
    .delete(
      "/:id",
      requirePermission(auth, "content:write"),
      validate("param", idParam),
      async (c) => {
        const [row] = await db
          .delete(books)
          .where(eq(books.id, c.req.valid("param").id))
          .returning({ id: books.id });
        return row ? c.body(null, 204) : notFound("book");
      },
    );
}
