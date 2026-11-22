import { Hono } from "hono";
import { and, count, desc, eq, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";
import {
  CAPSULE_LIMITS,
  formatLagosShortDate,
  lagosDate,
  lagosDayRange,
  nextLagosMidnight,
  slug,
} from "@kcom/content";
import { capsules, type CapsuleDb } from "@kcom/db";
import {
  assertCanChange,
  findById,
  idParam,
  notFound,
  pagination,
  publishStatus,
  rethrowWriteError,
  richTextSchema,
} from "../content/index.js";
import { actionForUpdate, logActivity } from "../activity.js";
import { HttpError } from "../errors.js";
import type { CapsuleEvents } from "../capsule-publishing.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";
import { present } from "./capsules.js";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).min(1).nullable();

const fields = {
  title: text(CAPSULE_LIMITS.title).min(1),
  slug,
  scriptureRef: optionalText(CAPSULE_LIMITS.scriptureRef),
  scriptureText: richTextSchema.nullable(),
  body: richTextSchema,
  decrees: z.array(text(1000).min(1)).max(20),
  prayer: richTextSchema.nullable(),
  bibleMeditation: optionalText(CAPSULE_LIMITS.bibleMeditation),
  authorSource: optionalText(CAPSULE_LIMITS.authorSource),
  seriesId: z.uuid().nullable(),
  partNumber: z.number().int().positive().nullable(),
  status: publishStatus,
  publishAt: z.coerce.date(),
};

const createBody = z.strictObject({
  ...fields,
  scriptureRef: fields.scriptureRef.default(null),
  scriptureText: fields.scriptureText.default(null),
  decrees: fields.decrees.default([]),
  prayer: fields.prayer.default(null),
  bibleMeditation: fields.bibleMeditation.default(null),
  authorSource: fields.authorSource.default(null),
  seriesId: fields.seriesId.default(null),
  partNumber: fields.partNumber.default(null),
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.optional(),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

/**
 * `from` (inclusive) and `to` (exclusive) bound publishAt, so the calendar can load one month.
 * Search and series filters for the list page still run in the browser; moving them
 * server-side is a follow-up.
 */
const listQuery = z
  .object({
    status: fields.status.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    ...pagination(),
  })
  .refine((q) => !q.from || !q.to || q.from < q.to, "from must be before to");

const CAPSULE_ERRORS = {
  label: "capsule slug",
  messages: { reference: "series does not exist", check: "part number needs a series" },
  unique: {
    capsules_one_per_lagos_day_idx:
      "that Lagos day already has a capsule; only one can go live per day",
  },
};

type Patch = z.infer<typeof updateBody>;

/**
 * Status transitions: draft -> scheduled -> published, scheduled -> draft
 * (unschedule) and published -> draft (unpublish; republishing fires the event
 * again). Published -> scheduled is rejected. Scheduling needs a future time (default: next Lagos midnight);
 * publishing happens now. Edits that don't set a status keep the schedule.
 */
function planStatusChange(
  existing: typeof capsules.$inferSelect,
  patch: Patch,
): { publishAt?: Date } {
  const now = new Date();
  const next = patch.status ?? existing.status;
  if (existing.status === "published" && next === "scheduled") {
    throw invalid("a published capsule cannot be scheduled; unpublish it to draft first");
  }
  if (next === "scheduled") {
    if (patch.publishAt) {
      if (patch.publishAt <= now) throw invalid("publishAt must be in the future to schedule");
      return {};
    }
    return existing.publishAt > now ? {} : { publishAt: nextLagosMidnight(now) };
  }
  if (patch.status === "published" && existing.status !== "published") {
    if (patch.publishAt && patch.publishAt > now) {
      throw invalid("use status scheduled for a future publishAt");
    }
    return patch.publishAt ? {} : { publishAt: now };
  }
  return {};
}
/** "13 Nov 2026" */
const friendlyDay = (at: Date) =>
  `${formatLagosShortDate(lagosDate(at))} ${lagosDate(at).slice(0, 4)}`;
const dayTaken = (publishAt: Date, title?: string) =>
  new HttpError(
    409,
    "day_taken",
    `${friendlyDay(publishAt)} already has ${title ? `“${title}”` : "a capsule"}; only one capsule can go live per Lagos day`,
  );
const invalid = (message: string) => new HttpError(422, "invalid_transition", message);

/** Editor/admin endpoints: full access to capsules including drafts and scheduled ones. */
export function adminCapsuleRoutes(db: CapsuleDb, events: CapsuleEvents) {
  const write = requireCan("content:write");
  const byId = (id: string) => findById(db, capsules, id, "capsule");

  /** One published or scheduled capsule per Lagos day (also enforced by a unique index). */
  async function assertDayFree(publishAt: Date, exceptId?: string) {
    const [from, to] = lagosDayRange(lagosDate(publishAt));
    const [taken] = await db
      .select({ title: capsules.title })
      .from(capsules)
      .where(
        and(
          ne(capsules.status, "draft"),
          gte(capsules.publishAt, from),
          lt(capsules.publishAt, to),
          exceptId ? ne(capsules.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (taken) throw dayTaken(publishAt, taken.title);
  }

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, from, to, limit, offset } = c.req.valid("query");
      const where = and(
        status ? eq(capsules.status, status) : undefined,
        from ? gte(capsules.publishAt, from) : undefined,
        to ? lt(capsules.publishAt, to) : undefined,
      );
      const [rows, [counted]] = await Promise.all([
        db
          .select()
          .from(capsules)
          .where(where)
          .orderBy(desc(capsules.publishAt), desc(capsules.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(capsules).where(where),
      ]);
      return c.json({ items: rows.map(present), total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(present(await byId(c.req.valid("param").id))),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const body = c.req.valid("json");
      assertCanChange(c, null, body.status);
      const now = new Date();
      // Default time: publish now when publishing, else the next Lagos midnight.
      const publishAt =
        body.publishAt ?? (body.status === "published" ? now : nextLagosMidnight(now));
      if (body.status === "scheduled" && publishAt <= now) {
        throw invalid("publishAt must be in the future to schedule");
      }
      if (body.status === "published" && publishAt > now) {
        throw invalid("use status scheduled for a future publishAt");
      }
      if (body.status !== "draft") await assertDayFree(publishAt);
      try {
        const [row] = await db
          .insert(capsules)
          .values({ ...body, publishAt })
          .returning();
        if (body.status === "published") await events.emitPublished(row!);
        await logActivity(db, c, {
          action: body.status === "draft" ? "create" : "publish",
          entityType: "capsule",
          entityId: row!.id,
          title: row!.title,
        });
        return c.json(present(row!), 201);
      } catch (err) {
        rethrowWriteError(err, CAPSULE_ERRORS);
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const existing = await byId(id);
      assertCanChange(c, existing.status, patch.status);
      const set = { ...patch, ...planStatusChange(existing, patch) };
      const finalStatus = set.status ?? existing.status;
      const finalAt = set.publishAt ?? existing.publishAt;
      if (
        finalStatus !== "draft" &&
        (existing.status === "draft" || lagosDate(finalAt) !== lagosDate(existing.publishAt))
      ) {
        await assertDayFree(finalAt, id);
      }
      const publishing = set.status === "published" && existing.status !== "published";
      try {
        // A publishing write only matches while the capsule is not yet published,
        // so a concurrent job run cannot make this publish (and its event) happen twice.
        const where = publishing
          ? and(eq(capsules.id, id), ne(capsules.status, "published"))
          : eq(capsules.id, id);
        const [row] = await db.update(capsules).set(set).where(where).returning();
        if (!row) return c.json(present(await byId(id)));
        if (publishing) await events.emitPublished(row);
        await logActivity(db, c, {
          action: actionForUpdate(existing.status, patch.status),
          entityType: "capsule",
          entityId: id,
          title: row.title,
        });
        return c.json(present(row));
      } catch (err) {
        rethrowWriteError(err, CAPSULE_ERRORS);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const existing = await byId(id);
      assertCanChange(c, existing.status);
      const rows = await db
        .delete(capsules)
        .where(eq(capsules.id, id))
        .returning({ id: capsules.id });
      if (rows.length === 0) throw notFound("capsule");
      await logActivity(db, c, {
        action: "delete",
        entityType: "capsule",
        entityId: id,
        title: existing.title,
      });
      return c.body(null, 204);
    });
}
