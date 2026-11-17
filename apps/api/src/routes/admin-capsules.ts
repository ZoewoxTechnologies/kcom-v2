import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { nextLagosMidnight, slug } from "@kcom/content";
import { capsules, type CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { rethrowWriteError } from "../db-errors.js";
import { HttpError } from "../errors.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { richTextSchema } from "../rich-text.js";
import { validate } from "../validate.js";
import { present } from "./capsules.js";

const idParam = z.object({ id: z.uuid() });
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
  status: z.enum(["draft", "scheduled", "published"]),
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
  .strictObject(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const listQuery = z.object({
  status: fields.status.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Editor/admin endpoints: full access to capsules including drafts and scheduled ones. */
export function adminCapsuleRoutes(db: CapsuleDb, auth: Auth) {
  const read = requirePermission(auth, "content:read");
  const write = requirePermission(auth, "content:write");
  const publish = requirePermission(auth, "content:publish");
  const byId = async (id: string) => {
    const [row] = await db.select().from(capsules).where(eq(capsules.id, id));
    if (!row) throw new HttpError(404, "not_found", "capsule not found");
    return row;
  };

  return new Hono<AuthEnv>()
    .get("/", read, validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const rows = await db
        .select()
        .from(capsules)
        .where(status ? eq(capsules.status, status) : undefined)
        .orderBy(desc(capsules.publishAt), desc(capsules.createdAt))
        .limit(limit)
        .offset(offset);
      return c.json(rows.map(present));
    })
    .get("/:id", read, validate("param", idParam), async (c) =>
      c.json(present(await byId(c.req.valid("param").id))),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const body = c.req.valid("json");
      if (body.status !== "draft") await requireContentPublish(publish, c);
      try {
        const [row] = await db.insert(capsules).values(body).returning();
        return c.json(present(row!), 201);
      } catch (err) {
        rethrowWriteError(err, "capsule");
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const existing = await byId(id);
      if (patch.status !== undefined && patch.status !== existing.status) {
        await requireContentPublish(publish, c);
      }
      try {
        const [row] = await db.update(capsules).set(patch).where(eq(capsules.id, id)).returning();
        return c.json(present(row!));
      } catch (err) {
        rethrowWriteError(err, "capsule");
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const rows = await db
        .delete(capsules)
        .where(eq(capsules.id, id))
        .returning({ id: capsules.id });
      if (rows.length === 0) throw new HttpError(404, "not_found", "capsule not found");
      return c.body(null, 204);
    });
}

/** Moving a capsule out of draft needs the publish permission, checked after write. */
async function requireContentPublish(
  publish: ReturnType<typeof requirePermission>,
  c: Parameters<ReturnType<typeof requirePermission>>[0],
) {
  await publish(c, async () => {});
}
