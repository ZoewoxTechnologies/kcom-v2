import { asc } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { books, type CapsuleDb } from "@kcom/db";
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

/** Editor/admin endpoints: full access to books including drafts and scheduled ones. */
export const adminBookRoutes = (db: CapsuleDb) =>
  adminCrudRoutes({
    db,
    table: books,
    label: "book",
    createBody,
    updateBody,
    orderBy: [asc(books.title)],
    errors: { messages: { reference: "author does not exist" } },
  });

/** Public, read-only: only published books whose publish time has passed. */
export const bookRoutes = (db: CapsuleDb) =>
  publicContentRoutes({ db, table: books, label: "book", orderBy: [asc(books.title)] });
