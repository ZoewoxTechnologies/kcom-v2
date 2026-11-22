import { Hono } from "hono";
import { asc, eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { ministryArms, siteSettings, teamMembers, type CapsuleDb } from "@kcom/db";
import { cloudinaryImageUrl, httpUrl, idParam, notFound, publicCache } from "../content/index.js";
import { HttpError } from "../errors.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const DEFAULT_SITE_NAME = "Kingdom Capstone Outreach Ministries";

/** Trimmed text; blank becomes null so a cleared field reads as unset. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));
const url = z
  .union([z.literal(""), httpUrl])
  .nullable()
  .transform((v) => (v ? v : null));
const email = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(320)
      .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "must be an email address"),
  ])
  .nullable()
  .transform((v) => (v ? v : null));
const image = z
  .union([z.literal(""), cloudinaryImageUrl])
  .nullable()
  .transform((v) => (v ? v : null));

/**
 * Grouped settings, mapped to flat `site_settings` columns. A group is public
 * unless listed in `adminOnlyGroups`; bank details are public because the
 * Partnership page shows them.
 */
const groups = {
  site: {
    siteName: z.string().trim().min(1).max(200),
    tagline: text(300),
    copyrightText: text(300),
    footerTagline: text(300),
  },
  contact: { email, phone: text(60), address: text(500) },
  social: {
    facebook: url,
    youtube: url,
    instagram: url,
    x: url,
    whatsappChannel: url,
    telegram: url,
  },
  bank: {
    bankName: text(200),
    accountName: text(200),
    accountNumber: text(60),
    sortOrSwift: text(60),
  },
  giving: { note: text(2000) },
} as const;

/** group -> field -> `site_settings` column. */
const columns = {
  site: {
    siteName: "siteName",
    tagline: "tagline",
    copyrightText: "copyrightText",
    footerTagline: "footerTagline",
  },
  contact: { email: "contactEmail", phone: "contactPhone", address: "postalAddress" },
  social: {
    facebook: "facebookUrl",
    youtube: "youtubeUrl",
    instagram: "instagramUrl",
    x: "xUrl",
    whatsappChannel: "whatsappChannelUrl",
    telegram: "telegramUrl",
  },
  bank: {
    bankName: "bankName",
    accountName: "bankAccountName",
    accountNumber: "bankAccountNumber",
    sortOrSwift: "bankSortOrSwift",
  },
  giving: { note: "givingNote" },
} as const satisfies Record<
  keyof typeof groups,
  Record<string, keyof typeof siteSettings.$inferSelect>
>;

/** Groups left out of the public response. None yet; the admin and public shapes are otherwise identical. */
const adminOnlyGroups: ReadonlySet<string> = new Set<string>();

const part = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape).partial().optional();
const settingsPatch = z
  .strictObject({
    site: part(groups.site),
    contact: part(groups.contact),
    social: part(groups.social),
    bank: part(groups.bank),
    giving: part(groups.giving),
  })
  .refine(
    (b) => Object.values(b).some((g) => g && Object.keys(g).length > 0),
    "no fields to update",
  );

type Row = typeof siteSettings.$inferSelect;

function shape(row: Row | undefined, includeAdminOnly: boolean) {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [group, map] of Object.entries(columns)) {
    if (!includeAdminOnly && adminOnlyGroups.has(group)) continue;
    out[group] = Object.fromEntries(
      Object.entries(map).map(([field, col]) => [
        field,
        row ? row[col as keyof Row] : col === "siteName" ? DEFAULT_SITE_NAME : null,
      ]),
    );
  }
  return out;
}

/** Fields of an ordered list (team, arms): zod rules and the response projection. */
type ListSpec = {
  table: typeof teamMembers | typeof ministryArms;
  /** Required fields, then optional ones (nullable, no default: a PATCH must not reset them). */
  required: z.ZodRawShape;
  optional: Record<string, z.ZodType>;
  columns: readonly string[];
  label: string;
};

const teamSpec: ListSpec = {
  table: teamMembers,
  label: "team member",
  columns: ["id", "name", "role", "bio", "portraitUrl"],
  required: { name: z.string().trim().min(1).max(200), role: z.string().trim().min(1).max(200) },
  optional: { bio: text(4000), portraitUrl: image },
};
const armsSpec: ListSpec = {
  table: ministryArms,
  label: "arm",
  columns: ["id", "name", "description", "imageUrl"],
  required: { name: z.string().trim().min(1).max(200) },
  optional: { description: text(4000), imageUrl: image },
};

const project = (spec: ListSpec, row: Record<string, unknown>) =>
  Object.fromEntries(spec.columns.map((c) => [c, row[c]]));

async function list(db: CapsuleDb, spec: ListSpec) {
  const t = spec.table;
  const rows = await db.select().from(t).orderBy(asc(t.position), asc(t.createdAt));
  return rows.map((r) => project(spec, r));
}

const orderBody = z.strictObject({ ids: z.array(z.uuid()).max(200) });

/** Admin routes for one ordered list: create, update, delete and persist a new order. */
function orderedListRoutes(db: CapsuleDb, spec: ListSpec) {
  const t = spec.table;
  // Defaults apply on create only: zod still applies `.default()` inside `.partial()`.
  const create = z.strictObject({
    ...spec.required,
    ...Object.fromEntries(
      Object.entries(spec.optional).map(([k, f]) => [k, (f as z.ZodNullable).default(null)]),
    ),
  });
  const update = z
    .strictObject({ ...spec.required, ...spec.optional })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "no fields to update");
  const byId = (id: string) => eq(t.id, id);
  return (
    new Hono<AuthEnv>()
      .get("/", async (c) => c.json({ items: await list(db, spec) }))
      .post("/", requireCan("settings:manage"), validate("json", create), async (c) => {
        const values = c.req.valid("json") as Record<string, unknown>;
        // The advisory lock serialises creates so two cannot take the same position.
        const row = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${spec.label}))`);
          const [{ next }] = (await tx
            .select({ next: sql<number>`coalesce(max(${t.position}) + 1, 0)` })
            .from(t)) as [{ next: number }];
          const [created] = await tx
            .insert(t as PgTable)
            .values({ ...values, position: next } as never)
            .returning();
          return created;
        });
        return c.json(project(spec, row as Record<string, unknown>), 201);
      })
      // Declared before "/:id" so "order" is not read as an id.
      .put("/order", requireCan("settings:manage"), validate("json", orderBody), async (c) => {
        const { ids } = c.req.valid("json");
        await db.transaction(async (tx) => {
          const existing = (await tx.select({ id: t.id }).from(t)).map((r) => r.id);
          if (
            ids.length !== existing.length ||
            new Set(ids).size !== ids.length ||
            !ids.every((i) => existing.includes(i))
          ) {
            throw new HttpError(
              422,
              "invalid_order",
              `ids must list every ${spec.label} exactly once`,
            );
          }
          for (const [position, id] of ids.entries()) {
            await tx
              .update(t as PgTable)
              .set({ position } as never)
              .where(byId(id));
          }
        });
        return c.json({ items: await list(db, spec) });
      })
      .patch(
        "/:id",
        requireCan("settings:manage"),
        validate("param", idParam),
        validate("json", update),
        async (c) => {
          const [row] = await db
            .update(t as PgTable)
            .set(c.req.valid("json") as never)
            .where(byId(c.req.valid("param").id))
            .returning();
          if (!row) throw notFound(spec.label);
          return c.json(project(spec, row as Record<string, unknown>));
        },
      )
      .delete("/:id", requireCan("settings:manage"), validate("param", idParam), async (c) => {
        const rows = await db
          .delete(t)
          .where(byId(c.req.valid("param").id))
          .returning({ id: t.id });
        if (rows.length === 0) throw notFound(spec.label);
        return c.body(null, 204);
      })
  );
}

/** Public, read-only: the non-sensitive settings plus team and arms in saved order. */
export function settingsRoutes(db: CapsuleDb) {
  return new Hono().use(publicCache).get("/", async (c) => {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
    return c.json({
      ...shape(row, false),
      team: await list(db, teamSpec),
      arms: await list(db, armsSpec),
    });
  });
}

/** Admin: read everything (any signed-in user), write needs `settings:manage` (Admin only). */
export function adminSettingsRoutes(db: CapsuleDb) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => {
      const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
      return c.json({
        ...shape(row, true),
        team: await list(db, teamSpec),
        arms: await list(db, armsSpec),
      });
    })
    .patch("/", requireCan("settings:manage"), validate("json", settingsPatch), async (c) => {
      const patch = c.req.valid("json") as Record<string, Record<string, unknown> | undefined>;
      const set: Record<string, unknown> = {};
      for (const [group, fields] of Object.entries(patch)) {
        for (const [field, value] of Object.entries(fields ?? {})) {
          set[(columns as Record<string, Record<string, string>>)[group]![field]!] = value;
        }
      }
      await db
        .insert(siteSettings)
        .values({ id: 1, siteName: DEFAULT_SITE_NAME, ...set })
        .onConflictDoUpdate({ target: siteSettings.id, set });
      const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
      return c.json(shape(row, true));
    })
    .route("/team", orderedListRoutes(db, teamSpec))
    .route("/arms", orderedListRoutes(db, armsSpec));
}
