import { Hono } from "hono";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { isLive, pages, pageSections, type CapsuleDb } from "@kcom/db";
import {
  assertCanChange,
  httpUrl,
  idParam,
  notFound,
  pagination,
  publicCache,
  publishStatus,
  rethrowWriteError,
  richTextSchema,
  slugParam,
} from "../content/index.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const text = (max: number) => z.string().trim().min(1).max(max);

/** Each section kind has its own strict props shape; unknown kinds are rejected. */
const section = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("richText"),
    props: z.strictObject({ body: richTextSchema }),
  }),
  z.strictObject({
    type: z.literal("hero"),
    props: z.strictObject({
      heading: text(200),
      subheading: text(500).optional(),
      imageUrl: httpUrl.optional(),
    }),
  }),
  z.strictObject({
    type: z.literal("cta"),
    props: z.strictObject({ label: text(100), url: httpUrl }),
  }),
]);

const fields = {
  title: text(200),
  slug,
  seoTitle: text(200).nullable(),
  seoDescription: text(500).nullable(),
  status: publishStatus,
  publishAt: z.coerce.date().nullable(),
  sections: z.array(section).max(50),
};

const createBody = z.strictObject({
  ...fields,
  seoTitle: fields.seoTitle.default(null),
  seoDescription: fields.seoDescription.default(null),
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.default(null),
  sections: fields.sections.default([]),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const listQuery = z.object({ status: publishStatus.optional(), ...pagination() });

type Page = typeof pages.$inferSelect;

async function withSections(db: CapsuleDb, page: Page) {
  const sections = await db
    .select({ type: pageSections.type, props: pageSections.props })
    .from(pageSections)
    .where(eq(pageSections.pageId, page.id))
    .orderBy(asc(pageSections.position));
  return { ...page, sections };
}

/** Public, read-only: published pages whose publish time has passed. */
export function pageRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/", async (c) =>
      c.json(
        await db
          .select({ slug: pages.slug, title: pages.title })
          .from(pages)
          .where(isLive(pages))
          .orderBy(asc(pages.title)),
      ),
    )
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [page] = await db
        .select()
        .from(pages)
        .where(and(eq(pages.slug, c.req.valid("param").slug), isLive(pages)))
        .limit(1);
      if (!page) throw notFound("page");
      return c.json(await withSections(db, page));
    });
}

const PAGE_ERRORS = { label: "page slug" };

const insertSections = (tx: CapsuleDb, pageId: string, items: z.output<typeof section>[]) =>
  items.length
    ? tx
        .insert(pageSections)
        .values(items.map((s, position) => ({ pageId, position, type: s.type, props: s.props })))
    : Promise.resolve();

/** Editor/admin endpoints: every page including drafts; sections are replaced as a whole. */
export function adminPageRoutes(db: CapsuleDb) {
  const write = requireCan("content:write");
  const byId = async (id: string) => {
    const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (!page) throw notFound("page");
    return page;
  };

  return new Hono<AuthEnv>()
    .get("/", validate("query", listQuery), async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const where = status ? eq(pages.status, status) : undefined;
      const [items, [counted]] = await Promise.all([
        db
          .select()
          .from(pages)
          .where(where)
          .orderBy(desc(pages.updatedAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(pages).where(where),
      ]);
      return c.json({ items, total: counted?.total ?? 0 });
    })
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await withSections(db, await byId(c.req.valid("param").id))),
    )
    .post("/", write, validate("json", createBody), async (c) => {
      const { sections, ...body } = c.req.valid("json");
      assertCanChange(c, null, body.status);
      try {
        const page = await db.transaction(async (tx) => {
          const [row] = await tx.insert(pages).values(body).returning();
          await insertSections(tx, row!.id, sections);
          return row!;
        });
        return c.json(await withSections(db, page), 201);
      } catch (err) {
        rethrowWriteError(err, PAGE_ERRORS);
      }
    })
    .patch("/:id", write, validate("param", idParam), validate("json", updateBody), async (c) => {
      const { id } = c.req.valid("param");
      const { sections, ...patch } = c.req.valid("json");
      const existing = await byId(id);
      assertCanChange(c, existing.status, patch.status);
      try {
        const page = await db.transaction(async (tx) => {
          const [row] = Object.keys(patch).length
            ? await tx.update(pages).set(patch).where(eq(pages.id, id)).returning()
            : [existing];
          if (sections) {
            await tx.delete(pageSections).where(eq(pageSections.pageId, id));
            await insertSections(tx, id, sections);
            if (!Object.keys(patch).length) {
              await tx.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, id));
            }
          }
          return row!;
        });
        return c.json(await withSections(db, page));
      } catch (err) {
        rethrowWriteError(err, PAGE_ERRORS);
      }
    })
    .delete("/:id", write, validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      assertCanChange(c, (await byId(id)).status);
      const rows = await db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id });
      if (rows.length === 0) throw notFound("page");
      return c.body(null, 204);
    });
}
