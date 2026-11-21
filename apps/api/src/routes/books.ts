import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { books, type CapsuleDb } from "@kcom/db";
import { requireCan } from "../require-permission.js";
import { validate } from "../validate.js";
import { HttpError } from "../errors.js";
import {
  adminCrudRoutes,
  cloudinaryImageUrl,
  httpUrl,
  publicContentRoutes,
  publishStatus,
  richTextSchema,
} from "../content/index.js";

const fields = {
  title: z.string().trim().min(1).max(200),
  slug,
  description: richTextSchema.nullable(),
  coverUrl: cloudinaryImageUrl.nullable(),
  purchaseUrl: httpUrl.max(2000).nullable(),
  publishedYear: z.number().int().min(1000).max(9999).nullable(),
  position: z.number().int().min(0).max(100_000),
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
  position: fields.position.default(0),
  authorId: fields.authorId.default(null),
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.default(null),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const orderBody = z.strictObject({ ids: z.array(z.uuid()).max(500) });
const order = [asc(books.position), asc(books.title)];

/** Editor/admin endpoints: full access to books including drafts and scheduled ones. */
export const adminBookRoutes = (db: CapsuleDb) => {
  const crud = adminCrudRoutes({
    db,
    table: books,
    label: "book",
    createBody,
    updateBody,
    orderBy: order,
    errors: { messages: { reference: "author does not exist" } },
  });
  // Chained after the CRUD router: its "/:id" routes only take PATCH, GET and DELETE, so PUT "/order" never collides.
  return crud.put("/order", requireCan("content:write"), validate("json", orderBody), async (c) => {
    const { ids } = c.req.valid("json");
    await db.transaction(async (tx) => {
      const existing = (await tx.select({ id: books.id }).from(books)).map((r) => r.id);
      if (
        ids.length !== existing.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((i) => existing.includes(i))
      ) {
        throw new HttpError(422, "invalid_order", "ids must list every book exactly once");
      }
      for (const [position, id] of ids.entries()) {
        await tx.update(books).set({ position }).where(eq(books.id, id));
      }
    });
    const items = await db
      .select()
      .from(books)
      .orderBy(...order);
    return c.json({ items });
  });
};

/** Public, read-only: only published books whose publish time has passed. */
export const bookRoutes = (db: CapsuleDb) =>
  publicContentRoutes({ db, table: books, label: "book", orderBy: order });
