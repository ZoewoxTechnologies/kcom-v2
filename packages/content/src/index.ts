import { z } from "zod";

/** Content model stubs. Fields will grow as the database schema lands. */

const id = z.string().min(1);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words separated by hyphens");
const status = z.enum(["draft", "published", "archived"]);

const base = {
  id,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
};

const publishable = {
  ...base,
  slug,
  title: z.string().min(1),
  status,
  publishedAt: z.coerce.date().nullable(),
};

export const personSchema = z.object({
  ...base,
  name: z.string().min(1),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const seriesSchema = z.object({
  ...publishable,
  description: z.string().optional(),
});

export const capsuleSchema = z.object({
  ...publishable,
  /** Day the devotional is for (YYYY-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scripture: z.string().optional(),
  scriptureReference: z.string().optional(),
  body: z.string(),
  decree: z.string().optional(),
  authorId: id.optional(),
  seriesId: id.optional(),
  legacyNodeId: z.number().int().optional(),
});

export const blogPostSchema = z.object({
  ...publishable,
  excerpt: z.string().optional(),
  body: z.string(),
  authorId: id.optional(),
  tags: z.array(z.string()).default([]),
});

export const pageSchema = z.object({
  ...publishable,
  body: z.string(),
});

export const bookSchema = z.object({
  ...publishable,
  description: z.string().optional(),
  coverUrl: z.string().url().optional(),
  purchaseUrl: z.string().url().optional(),
  authorId: id.optional(),
});

export const galleryAlbumSchema = z.object({
  ...publishable,
  description: z.string().optional(),
  images: z
    .array(z.object({ url: z.string().url(), alt: z.string(), caption: z.string().optional() }))
    .default([]),
});

export const settingsSchema = z.object({
  siteName: z.string().min(1),
  tagline: z.string().optional(),
  contactEmail: z.string().email().optional(),
  socialLinks: z.record(z.string().url()).default({}),
});

export const subscriberSchema = z.object({
  ...base,
  email: z.string().email(),
  name: z.string().optional(),
  confirmedAt: z.coerce.date().nullable(),
  unsubscribedAt: z.coerce.date().nullable(),
});

export type Person = z.infer<typeof personSchema>;
export type Series = z.infer<typeof seriesSchema>;
export type Capsule = z.infer<typeof capsuleSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Book = z.infer<typeof bookSchema>;
export type GalleryAlbum = z.infer<typeof galleryAlbumSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Subscriber = z.infer<typeof subscriberSchema>;
