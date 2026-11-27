import { desc } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { blogPosts, type CapsuleDb } from "@kcom/db";
import {
  adminCrudRoutes,
  cloudinaryImageUrl,
  publishStatus,
  richTextSchema,
} from "../content/index.js";

const text = (max: number) => z.string().trim().max(max);

const fields = {
  title: text(200).min(1),
  slug,
  date: z.iso.date(),
  excerpt: text(500).min(1).nullable(),
  body: richTextSchema,
  heroImageUrl: cloudinaryImageUrl.nullable(),
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

const BLOG_ERRORS = { messages: { reference: "author does not exist" } };

/** Editor/admin endpoints: full access to blog posts including drafts and scheduled ones. */
export const adminBlogRoutes = (db: CapsuleDb) =>
  adminCrudRoutes({
    db,
    table: blogPosts,
    label: "post",
    entity: "blog",
    createBody,
    updateBody,
    orderBy: [desc(blogPosts.date), desc(blogPosts.createdAt)],
    errors: BLOG_ERRORS,
  });
