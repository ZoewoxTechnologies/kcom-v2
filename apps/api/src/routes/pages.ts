import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { slug } from "@kcom/content";
import { isLive, pages, pageSections, type CapsuleDb } from "@kcom/db";
import {
  adminCrudRoutes,
  assertCanChange,
  findById,
  httpUrl,
  idParam,
  notFound,
  publicCache,
  publicContentRoutes,
  publishStatus,
  richTextSchema,
  slugParam,
} from "../content/index.js";
import { requireCan } from "../require-permission.js";
import { validate } from "../validate.js";

const text = (max: number) => z.string().trim().min(1).max(max);

const link = z.strictObject({ label: text(100), url: httpUrl });
const quote = z.strictObject({ text: text(1000), cite: text(200).optional() });

/**
 * Each section kind has its own strict props shape; unknown kinds are rejected.
 * The set covers the About, Team and Arms, and Partnership designs:
 * title band (hero), prose, pull quote, photo, card grids (team members, arms,
 * ways to partner), headed bullet lists, and the bank-details block.
 */
const section = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("hero"),
    props: z.strictObject({
      eyebrow: text(100).optional(),
      heading: text(200),
      subheading: text(500).optional(),
      quote: quote.optional(),
      imageUrl: httpUrl.optional(),
    }),
  }),
  z.strictObject({
    type: z.literal("richText"),
    props: z.strictObject({ heading: text(200).optional(), body: richTextSchema }),
  }),
  z.strictObject({ type: z.literal("quote"), props: quote }),
  z.strictObject({
    type: z.literal("image"),
    props: z.strictObject({
      url: httpUrl,
      alt: z.string().trim().max(300),
      caption: text(300).optional(),
    }),
  }),
  z.strictObject({
    type: z.literal("cardGrid"),
    props: z.strictObject({
      heading: text(200).optional(),
      intro: text(1000).optional(),
      cards: z
        .array(
          z.strictObject({
            eyebrow: text(50).optional(),
            title: text(200),
            subtitle: text(200).optional(),
            text: text(2000).optional(),
            imageUrl: httpUrl.optional(),
            link: link.optional(),
          }),
        )
        .max(60),
    }),
  }),
  z.strictObject({
    type: z.literal("columns"),
    props: z.strictObject({
      heading: text(200).optional(),
      intro: text(500).optional(),
      columns: z
        .array(z.strictObject({ heading: text(200), items: z.array(text(500)).max(30) }))
        .max(6),
    }),
  }),
  z.strictObject({ type: z.literal("cta"), props: link.extend({ text: text(500).optional() }) }),
  /** Bank details come from site settings, so the section itself carries no data. */
  z.strictObject({ type: z.literal("bankDetails"), props: z.strictObject({}) }),
]);

const fields = {
  title: text(200),
  slug,
  seoTitle: text(200).nullable(),
  seoDescription: text(500).nullable(),
  status: publishStatus,
  publishAt: z.coerce.date().nullable(),
};
const createBody = z.strictObject({
  ...fields,
  seoTitle: fields.seoTitle.default(null),
  seoDescription: fields.seoDescription.default(null),
  status: fields.status.default("draft"),
  publishAt: fields.publishAt.default(null),
});
const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "no fields to update");

const sectionsBody = z.strictObject({ sections: z.array(section).max(50) });

const sectionsOf = (db: CapsuleDb, pageId: string) =>
  db
    .select({ type: pageSections.type, props: pageSections.props })
    .from(pageSections)
    .where(eq(pageSections.pageId, pageId))
    .orderBy(asc(pageSections.position));

/**
 * Public, read-only. The page and its ordered sections come back in one
 * response; the list is the shared live-content list.
 */
export function pageRoutes(db: CapsuleDb) {
  return new Hono()
    .use(publicCache)
    .get("/:slug", validate("param", slugParam), async (c) => {
      const [page] = await db
        .select()
        .from(pages)
        .where(and(eq(pages.slug, c.req.valid("param").slug), isLive(pages)))
        .limit(1);
      if (!page) throw notFound("page");
      return c.json({ ...page, sections: await sectionsOf(db, page.id) });
    })
    .route(
      "/",
      publicContentRoutes({ db, table: pages, label: "page", orderBy: [asc(pages.title)] }),
    );
}

/**
 * Page fields use the shared CRUD routes; a page's sections are replaced as a
 * whole by one transactional endpoint, which stays custom.
 */
export function adminPageRoutes(db: CapsuleDb) {
  return adminCrudRoutes({
    db,
    table: pages,
    label: "page",
    createBody,
    updateBody,
    orderBy: [asc(pages.title)],
  })
    .get("/:id/sections", validate("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      await findById(db, pages, id, "page");
      return c.json({ sections: await sectionsOf(db, id) });
    })
    .put(
      "/:id/sections",
      requireCan("content:write"),
      validate("param", idParam),
      validate("json", sectionsBody),
      async (c) => {
        const { id } = c.req.valid("param");
        const { sections } = c.req.valid("json");
        assertCanChange(c, (await findById(db, pages, id, "page")).status);
        await db.transaction(async (tx) => {
          await tx.delete(pageSections).where(eq(pageSections.pageId, id));
          if (sections.length) {
            await tx
              .insert(pageSections)
              .values(sections.map((s, position) => ({ pageId: id, position, ...s })));
          }
          await tx.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, id));
        });
        return c.json({ sections: await sectionsOf(db, id) });
      },
    );
}
