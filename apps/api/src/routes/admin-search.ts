import { Hono } from "hono";
import { desc, ilike } from "drizzle-orm";
import { z } from "zod";
import { blogPosts, capsules, events, type CapsuleDb } from "@kcom/db";
import type { AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const PER_KIND = 5;

const query = z.object({ q: z.string().trim().min(1).max(100) });

/** Matches the text anywhere, treating % and _ in it literally. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * Global admin search over capsule, blog and event titles, behind the /admin
 * guard. Returns at most a handful of matches per kind, newest first.
 */
export function adminSearchRoutes(db: CapsuleDb) {
  return new Hono<AuthEnv>().get("/", validate("query", query), async (c) => {
    const pattern = like(c.req.valid("query").q);
    const [capsuleRows, blogRows, eventRows] = await Promise.all([
      db
        .select({ id: capsules.id, title: capsules.title, status: capsules.status })
        .from(capsules)
        .where(ilike(capsules.title, pattern))
        .orderBy(desc(capsules.createdAt))
        .limit(PER_KIND),
      db
        .select({ id: blogPosts.id, title: blogPosts.title, status: blogPosts.status })
        .from(blogPosts)
        .where(ilike(blogPosts.title, pattern))
        .orderBy(desc(blogPosts.date))
        .limit(PER_KIND),
      db
        .select({ id: events.id, title: events.title, status: events.status })
        .from(events)
        .where(ilike(events.title, pattern))
        .orderBy(desc(events.startsAt))
        .limit(PER_KIND),
    ]);
    return c.json({
      items: [
        ...capsuleRows.map((r) => ({ kind: "capsule" as const, ...r })),
        ...blogRows.map((r) => ({ kind: "blog" as const, ...r })),
        ...eventRows.map((r) => ({ kind: "event" as const, ...r })),
      ],
    });
  });
}
