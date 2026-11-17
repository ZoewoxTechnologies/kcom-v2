import { Hono } from "hono";
import { asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { homepageSectionKeys, homepageSections, type CapsuleDb } from "@kcom/db";
import { publicCache } from "../content/index.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const key = z.enum(homepageSectionKeys);

/**
 * The full new layout, in display order. Every section must appear exactly once;
 * Today's Capsule must stay first and visible.
 */
const layoutBody = z
  .strictObject({
    sections: z.array(z.strictObject({ key, visible: z.boolean() })),
  })
  .superRefine(({ sections }, ctx) => {
    const keys = sections.map((s) => s.key);
    if (new Set(keys).size !== keys.length || keys.length !== homepageSectionKeys.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "list every section exactly once",
      });
      return;
    }
    const first = sections[0]!;
    if (first.key !== "todays_capsule" || !first.visible) {
      ctx.addIssue({
        code: "custom",
        path: ["sections", 0],
        message: "todays_capsule must stay first and visible",
      });
    }
  });

const list = (db: CapsuleDb) =>
  db
    .select({
      key: homepageSections.key,
      position: homepageSections.position,
      visible: homepageSections.visible,
    })
    .from(homepageSections)
    .orderBy(asc(homepageSections.position));

/** Public, read-only: visible sections in display order. */
export function homepageRoutes(db: CapsuleDb) {
  return new Hono().use(publicCache).get("/", async (c) => {
    const rows = await list(db);
    return c.json({ sections: rows.filter((s) => s.visible).map(({ key }) => ({ key })) });
  });
}

/** Admin: read the layout and replace it. Changes go live at once, so they need publish rights. */
export function adminHomepageRoutes(db: CapsuleDb) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => c.json({ sections: await list(db) }))
    .put("/", requireCan("content:publish"), validate("json", layoutBody), async (c) => {
      const { sections } = c.req.valid("json");
      await db.transaction(async (tx) => {
        // Positions are unique, so park the movable rows out of range before assigning the new order.
        await tx
          .update(homepageSections)
          .set({ position: sql`${homepageSections.position} + 100` })
          .where(ne(homepageSections.key, "todays_capsule"));
        for (const [position, s] of sections.entries()) {
          await tx
            .update(homepageSections)
            .set({ position, visible: s.visible })
            .where(eq(homepageSections.key, s.key));
        }
      });
      return c.json({ sections: await list(db) });
    });
}
