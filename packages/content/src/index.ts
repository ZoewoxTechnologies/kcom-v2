import { z } from "zod";

/** Content model stubs. Fields will grow as the database schema lands. */

const id = z.string().min(1);
export const slug = z
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

export const capsuleStatus = z.enum(["draft", "scheduled", "published"]);

/** Rich text is a JSON document (editor-agnostic). */
const richText = z.record(z.string(), z.unknown());

/** Maximum lengths of the capsule text fields; the API and the migration both use these. */
export const CAPSULE_LIMITS = { title: 200, scriptureRef: 200, authorSource: 200, bibleMeditation: 500 } as const;

export const capsuleSchema = z.object({
  ...base,
  slug,
  title: z.string().trim().min(1).max(CAPSULE_LIMITS.title),
  status: capsuleStatus,
  /** Go-live instant. Defaults to the next midnight Africa/Lagos (see nextLagosMidnight). */
  publishAt: z.coerce.date(),
  scriptureRef: z.string().max(CAPSULE_LIMITS.scriptureRef).nullable().default(null),
  scriptureText: richText.nullable().default(null),
  body: richText,
  decrees: z.array(z.string()).default([]),
  prayer: richText.nullable().default(null),
  /** Passages to read and meditate on today. */
  bibleMeditation: z.string().max(CAPSULE_LIMITS.bibleMeditation).nullable().default(null),
  /** Display credit, e.g. "Adetokunbo O. Ilesanmi (Meditations)". */
  authorSource: z.string().max(CAPSULE_LIMITS.authorSource).nullable().default(null),
  seriesId: id.nullable().default(null),
  partNumber: z.number().int().positive().nullable().default(null),
  legacyNid: z.number().int().nullable().default(null),
  legacyPath: z.string().nullable().default(null),
});

export const blogPostSchema = z.object({
  ...publishable,
  excerpt: z.string().optional(),
  body: z.string(),
  authorId: id.optional(),
  tags: z.array(z.string()).default([]),
});

const optionalText = z.string().min(1).nullable().default(null);
const optionalUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//.test(u), "must be an http(s) URL")
  .nullable()
  .default(null);

export const settingsSchema = z.object({
  siteName: z.string().min(1),
  tagline: optionalText,
  contactEmail: z.string().email().nullable().default(null),
  copyrightText: optionalText,
  footerTagline: optionalText,
  postalAddress: optionalText,
  facebookUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  instagramUrl: optionalUrl,
  xUrl: optionalUrl,
  whatsappChannelUrl: optionalUrl,
  telegramUrl: optionalUrl,
  bankName: optionalText,
  bankAccountName: optionalText,
  bankAccountNumber: optionalText,
  givingNote: optionalText,
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
export type Settings = z.infer<typeof settingsSchema>;
export type Subscriber = z.infer<typeof subscriberSchema>;

export { RICH_TEXT_MARKS, RICH_TEXT_NODES, isSafeHref, richTextHeadingLevel } from "./rich-text.js";

export {
  dayParts,
  formatLagosDate,
  formatLagosShortDate,
  lagosDate,
  lagosDayRange,
  lagosMonth,
  lagosMonthRange,
  monthKey,
  monthLabel,
  monthName,
  monthShort,
  nextLagosMidnight,
  shiftMonth,
  shortMonthYear,
  slugify,
} from "./publish.js";
export type { DayParts } from "./publish.js";
