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
  publicContentRoutes,
  publishStatus,
  richTextSchema,
  slugParam,
} from "../content/index.js";
import { requireCan } from "../require-permission.js";
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

/** Public, read-only: live pages by slug, plus each page's ordered sections. */
export function pageRoutes(db: CapsuleDb) {
  return publicContentRoutes({
    db,
    table: pages,
    label: "page",
    orderBy: [asc(pages.title)],
  }).get("/:slug/sections", validate("param", slugParam), async (c) => {
    const [page] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.slug, c.req.valid("param").slug), isLive(pages)))
      .limit(1);
    if (!page) throw notFound("page");
    return c.json({ sections: await sectionsOf(db, page.id) });
  });
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
