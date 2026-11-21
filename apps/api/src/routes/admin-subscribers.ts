import { Hono } from "hono";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { lagosMonth, lagosMonthRange } from "@kcom/content";
import { subscribers, type CapsuleDb } from "@kcom/db";
import type { AuthEnv } from "../require-permission.js";

/** Read-only subscriber figures for the admin dashboard. Behind the /admin guard. */
export function adminSubscriberRoutes(db: CapsuleDb) {
  return new Hono<AuthEnv>().get("/count", async (c) => {
    const [from, to] = lagosMonthRange(lagosMonth(new Date()));
    const confirmed = eq(subscribers.status, "confirmed");
    const [[total], [added]] = await Promise.all([
      db.select({ n: count() }).from(subscribers).where(confirmed),
      db
        .select({ n: count() })
        .from(subscribers)
        .where(and(confirmed, gte(subscribers.confirmedAt, from), lt(subscribers.confirmedAt, to))),
    ]);
    return c.json({ confirmed: total!.n, addedThisMonth: added!.n });
  });
}
