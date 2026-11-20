import { Hono } from "hono";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { contactMessages, type CapsuleDb } from "@kcom/db";
import { contactTopics } from "@kcom/db/contact-topics";
import { idParam, pagination } from "../content/schemas.js";
import { HttpError } from "../errors.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { can } from "../permissions.js";
import { validate } from "../validate.js";

const listQuery = z.object({
  ...pagination(25),
  status: z.enum(["new", "read"]).optional(),
  topic: z.enum(contactTopics).optional(),
});
const statusBody = z.strictObject({ status: z.enum(["new", "read"]) });

/**
 * Admin inbox over `contact_messages`. Messages senders marked private are
 * invisible (absent from lists and counts, 404 by id) without `prayer:read`.
 */
export const adminContactRoutes = (db: CapsuleDb) => {
  const visible = (c: { var: AuthEnv["Variables"] }): SQL | undefined =>
    can(c.var.user.role, "prayer:read") ? undefined : eq(contactMessages.keepPrivate, false);

  const one = async (c: Parameters<typeof visible>[0], id: string) => {
    const [row] = await db
      .select()
      .from(contactMessages)
      .where(and(eq(contactMessages.id, id), visible(c)));
    if (!row) throw new HttpError(404, "not_found", "message not found");
    return row;
  };

  return new Hono<AuthEnv>()
    .use(requireCan("inbox:read"))
    .get("/", validate("query", listQuery), async (c) => {
      const { limit, offset, status, topic } = c.req.valid("query");
      const where = and(
        visible(c),
        status && eq(contactMessages.status, status),
        topic && eq(contactMessages.topic, topic),
      );
      const [items, [total]] = await Promise.all([
        db
          .select()
          .from(contactMessages)
          .where(where)
          .orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(contactMessages).where(where),
      ]);
      return c.json({ items, total: total!.total });
    })
    .get("/unread-count", async (c) => {
      const [row] = await db
        .select({ unread: count() })
        .from(contactMessages)
        .where(and(visible(c), eq(contactMessages.status, "new")));
      return c.json({ unread: row!.unread });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await one(c, c.req.valid("param").id)),
    )
    .patch(
      "/:id",
      validate("param", idParam),
      validate("json", statusBody),
      async (c) => {
        const { id } = c.req.valid("param");
        await one(c, id);
        const [row] = await db
          .update(contactMessages)
          .set({ status: c.req.valid("json").status })
          .where(eq(contactMessages.id, id))
          .returning();
        return c.json(row);
      },
    );
};
