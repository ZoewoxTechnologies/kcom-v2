import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
    scriptureRef: text("scripture_ref"),
    scriptureText: jsonb("scripture_text").$type<RichText>(),
    body: jsonb("body").$type<RichText>().notNull(),
    decrees: text("decrees")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    prayer: jsonb("prayer").$type<RichText>(),
    /** Passages to read and meditate on today (free text, e.g. "Romans 12:1-8; Philippians 4:4-9"). */
    bibleMeditation: text("bible_meditation"),
    /** Display credit, e.g. "Adetokunbo O. Ilesanmi (Meditations)". Changed when a capsule is by someone else. */
    authorSource: text("author_source"),
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
    partNumber: integer("part_number"),
    status: publishStatus("status").notNull().default("draft"),
    /** Go-live instant. The app defaults it to the next midnight Africa/Lagos. */
    publishAt: timestamp("publish_at", { withTimezone: true }).notNull(),
    legacyNid: integer("legacy_nid").unique(),
    legacyPath: text("legacy_path"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("capsules_legacy_path_idx").on(t.legacyPath),
    index("capsules_status_publish_at_idx").on(t.status, t.publishAt),
    check("capsules_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("capsules_title_not_blank", sql`btrim(${t.title}) <> ''`),
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

/** Fixed set of homepage blocks; editors reorder or hide them but never add or remove. */
export const homepageSectionKeys = [
  "todays_capsule",
  "current_series",
  "past_series",
  "blog",
  "events_books",
  "email_signup",
] as const;
export type HomepageSectionKey = (typeof homepageSectionKeys)[number];

export const homepageSections = pgTable(
  "homepage_sections",
  {
    key: text("key").$type<HomepageSectionKey>().primaryKey(),
    position: integer("position").notNull(),
    visible: boolean("visible").notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("homepage_sections_position_idx").on(t.position),
    check(
      "homepage_sections_key_valid",
      sql`${t.key} IN ('todays_capsule','current_series','past_series','blog','events_books','email_signup')`,
    ),
    // Today's Capsule is pinned first and always shown.
    check(
      "homepage_sections_capsule_pinned",
      sql`${t.key} <> 'todays_capsule' OR (${t.position} = 0 AND ${t.visible})`,
    ),
  ],
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

export const siteSettings = pgTable(
  "site_settings",
  {
    /** Singleton: always 1. */
    id: integer("id").primaryKey().default(1),
    siteName: text("site_name").notNull(),
    tagline: text("tagline"),
    contactEmail: text("contact_email"),
    copyrightText: text("copyright_text"),
    footerTagline: text("footer_tagline"),
    postalAddress: text("postal_address"),
    facebookUrl: text("facebook_url"),
    youtubeUrl: text("youtube_url"),
    instagramUrl: text("instagram_url"),
    xUrl: text("x_url"),
    whatsappChannelUrl: text("whatsapp_channel_url"),
    telegramUrl: text("telegram_url"),
    bankName: text("bank_name"),
    bankAccountName: text("bank_account_name"),
    bankAccountNumber: text("bank_account_number"),
    givingNote: text("giving_note"),
    updatedAt: updatedAt(),
  },
  (t) => {
    const url = (c: typeof t.facebookUrl) => sql`${c} IS NULL OR ${c} ~ '^https?://[^\s]+$'`;
    return [
      check("site_settings_singleton", sql`${t.id} = 1`),
      check(
        "site_settings_email_format",
        sql`${t.contactEmail} IS NULL OR ${t.contactEmail} ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'`,
      ),
      check("site_settings_facebook_url", url(t.facebookUrl)),
      check("site_settings_youtube_url", url(t.youtubeUrl)),
      check("site_settings_instagram_url", url(t.instagramUrl)),
      check("site_settings_x_url", url(t.xUrl)),
      check("site_settings_whatsapp_url", url(t.whatsappChannelUrl)),
      check("site_settings_telegram_url", url(t.telegramUrl)),
    ];
  },
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

// Auth tables (Better Auth). Ids are text because Better Auth generates them.

export const userRoles = ["admin", "editor"] as const;
export type UserRole = (typeof userRoles)[number];

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").$type<UserRole>().notNull().default("editor"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_role_valid", sql`${t.role} IN ('admin', 'editor')`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    /** Password hash for the credential provider. */
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Shared across API instances so failed-sign-in limits survive restarts and scale-out. */
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
