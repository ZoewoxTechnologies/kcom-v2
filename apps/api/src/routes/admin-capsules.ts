import { Hono } from "hono";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { nextLagosMidnight, slug } from "@kcom/content";
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
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";
import { present } from "./capsules.js";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).min(1).nullable();

const fields = {
  title: text(200).min(1),
  slug,
  scriptureRef: optionalText(200),
  scriptureText: richTextSchema.nullable(),
  body: richTextSchema,
  decrees: z.array(text(1000).min(1)).max(20),
  prayer: richTextSchema.nullable(),
  bibleMeditation: optionalText(500),
  authorSource: optionalText(200),
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
  publishAt: fields.publishAt.default(() => nextLagosMidnight()),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const listQuery = z.object({
  status: fields.status.optional(),
  ...pagination(),
});

const CAPSULE_ERRORS = {
  label: "capsule slug",
  messages: { reference: "series does not exist", check: "part number needs a series" },
};

/** Editor/admin endpoints: full access to capsules including drafts and scheduled ones. */
export function adminCapsuleRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  const byId = (id: string) => findById(db, capsules, id, "capsule");

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const where = status ? eq(capsules.status, status) : undefined;
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
      try {
        const [row] = await db.insert(capsules).values(body).returning();
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
      try {
        const [row] = await db.update(capsules).set(patch).where(eq(capsules.id, id)).returning();
        return c.json(present(row!));
      } catch (err) {
        rethrowWriteError(err, CAPSULE_ERRORS);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      assertCanChange(c, (await byId(id)).status);
      const rows = await db
        .delete(capsules)
        .where(eq(capsules.id, id))
        .returning({ id: capsules.id });
      if (rows.length === 0) throw notFound("capsule");
      return c.body(null, 204);
    });
}
