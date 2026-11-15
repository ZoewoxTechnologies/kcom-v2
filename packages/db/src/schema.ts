import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Rich text is stored as a JSON document (editor-agnostic). */
export type RichText = Record<string, unknown>;

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const publishStatus = pgEnum("publish_status", ["draft", "scheduled", "published"]);
export const subscriberStatus = pgEnum("subscriber_status", [
  "pending",
  "confirmed",
  "unsubscribed",
]);

export const people = pgTable("people", {
  id: id(),
  name: text("name").notNull(),
  role: text("role"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const series = pgTable("series", {
  id: id(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const capsules = pgTable(
  "capsules",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    date: date("date", { mode: "string" }).notNull(),
    scriptureRef: text("scripture_ref"),
    scriptureText: jsonb("scripture_text").$type<RichText>(),
    body: jsonb("body").$type<RichText>().notNull(),
    decrees: text("decrees")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    prayer: jsonb("prayer").$type<RichText>(),
    authorId: uuid("author_id").references(() => people.id, { onDelete: "set null" }),
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
    partNumber: integer("part_number"),
    status: publishStatus("status").notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    legacyNid: integer("legacy_nid").unique(),
    legacyPath: text("legacy_path"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("capsules_legacy_path_idx").on(t.legacyPath),
    index("capsules_status_date_idx").on(t.status, t.date),
    index("capsules_series_idx").on(t.seriesId, t.partNumber),
    check("capsules_part_needs_series", sql`${t.partNumber} IS NULL OR ${t.seriesId} IS NOT NULL`),
  ],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    date: date("date", { mode: "string" }).notNull(),
    excerpt: text("excerpt"),
    body: jsonb("body").$type<RichText>().notNull(),
    heroImageUrl: text("hero_image_url"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    authorId: uuid("author_id").references(() => people.id, { onDelete: "set null" }),
    status: publishStatus("status").notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    legacyNid: integer("legacy_nid").unique(),
    legacyPath: text("legacy_path"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("blog_posts_status_date_idx").on(t.status, t.date),
    uniqueIndex("blog_posts_legacy_path_idx").on(t.legacyPath),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    status: publishStatus("status").notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    legacyPath: text("legacy_path"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pages_legacy_path_idx").on(t.legacyPath)],
);

export const pageSections = pgTable(
  "page_sections",
  {
    id: id(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Section kind, e.g. "hero", "richText", "cta". Props shape depends on it. */
    type: text("type").notNull(),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("page_sections_page_position_idx").on(t.pageId, t.position)],
);

export const books = pgTable("books", {
  id: id(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: jsonb("description").$type<RichText>(),
  coverUrl: text("cover_url"),
  purchaseUrl: text("purchase_url"),
  publishedYear: integer("published_year"),
  authorId: uuid("author_id").references(() => people.id, { onDelete: "set null" }),
  status: publishStatus("status").notNull().default("draft"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const galleryAlbums = pgTable("gallery_albums", {
  id: id(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  date: date("date", { mode: "string" }),
  status: publishStatus("status").notNull().default("draft"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const images = pgTable(
  "images",
  {
    id: id(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    caption: text("caption"),
    createdAt: createdAt(),
  },
  (t) => [index("images_album_idx").on(t.albumId, t.position)],
);

export const siteSettings = pgTable(
  "site_settings",
  {
    /** Singleton: always 1. */
    id: integer("id").primaryKey().default(1),
    siteName: text("site_name").notNull(),
    tagline: text("tagline"),
    contactEmail: text("contact_email"),
    footerText: text("footer_text"),
    givingInfo: jsonb("giving_info").$type<Record<string, unknown>>().notNull().default({}),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    updatedAt: updatedAt(),
  },
  (t) => [check("site_settings_singleton", sql`${t.id} = 1`)],
);

export const subscribers = pgTable(
  "subscribers",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    status: subscriberStatus("status").notNull().default("pending"),
    confirmToken: text("confirm_token").unique(),
    source: text("source"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscribers_email_idx").on(sql`lower(${t.email})`)],
);
