import { Hono } from "hono";
import { and, asc, count, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { lagosMonth, lagosMonthRange } from "@kcom/content";
import { subscribers, type CapsuleDb } from "@kcom/db";
import { pagination } from "../content/schemas.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";

const statuses = ["pending", "confirmed", "unsubscribed"] as const;
const sortKeys = ["name", "email", "status", "joined"] as const;

const filters = {
  q: z.string().trim().max(100).optional(),
  status: z.enum(statuses).optional(),
};
const listQuery = z.object({
  ...pagination(25),
  ...filters,
  sort: z.enum(sortKeys).default("joined"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});
const exportQuery = z.object(filters);

/** Matches name or email, treating % and _ in the search text literally. */
const search = (q: string): SQL => {
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  return or(ilike(subscribers.name, like), ilike(subscribers.email, like))!;
};

const csvCell = (value: string) => {
  // A leading = + - @ makes spreadsheets run the cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Admin subscriber list, counts and CSV export, behind the /admin guard.
 * The export needs `subscribers:export` (admin only).
 */
export function adminSubscriberRoutes(db: CapsuleDb) {
  const where = (q?: string, status?: (typeof statuses)[number]) =>
    and(q ? search(q) : undefined, status && eq(subscribers.status, status));

  return new Hono<AuthEnv>()
    .get("/count", async (c) => {
      const [from, to] = lagosMonthRange(lagosMonth(new Date()));
      const confirmed = eq(subscribers.status, "confirmed");
      const [[total], [added]] = await Promise.all([
        db.select({ n: count() }).from(subscribers).where(confirmed),
        db
          .select({ n: count() })
          .from(subscribers)
          .where(
            and(confirmed, gte(subscribers.confirmedAt, from), lt(subscribers.confirmedAt, to)),
          ),
      ]);
      return c.json({ confirmed: total!.n, addedThisMonth: added!.n });
    })
    .get("/", validate("query", listQuery), async (c) => {
      const { limit, offset, q, status, sort, dir } = c.req.valid("query");
      const column = {
        name: sql`lower(${subscribers.name})`,
        email: sql`lower(${subscribers.email})`,
        status: subscribers.status,
        joined: subscribers.subscribedAt,
      }[sort];
      const order = dir === "asc" ? asc : desc;
      const filter = where(q, status);
      const [items, [total], byStatus] = await Promise.all([
        db
          .select({
            id: subscribers.id,
            name: subscribers.name,
            email: subscribers.email,
            status: subscribers.status,
            subscribedAt: subscribers.subscribedAt,
          })
          .from(subscribers)
          .where(filter)
          .orderBy(order(column), asc(subscribers.id))
          .limit(limit)
          .offset(offset),
        db.select({ n: count() }).from(subscribers).where(filter),
        // Counts follow the search text but not the status filter, so every tab shows its size.
        db
          .select({ status: subscribers.status, n: count() })
          .from(subscribers)
          .where(where(q))
          .groupBy(subscribers.status),
      ]);
      const counts = { pending: 0, confirmed: 0, unsubscribed: 0 };
      for (const row of byStatus) counts[row.status] = row.n;
      return c.json({ items, total: total!.n, counts });
    })
    .get(
      "/export.csv",
      requireCan("subscribers:export"),
      validate("query", exportQuery),
      async (c) => {
        const { q, status } = c.req.valid("query");
        const rows = await db
          .select({
            email: subscribers.email,
            name: subscribers.name,
            status: subscribers.status,
            subscribedAt: subscribers.subscribedAt,
            confirmedAt: subscribers.confirmedAt,
          })
          .from(subscribers)
          .where(where(q, status))
          .orderBy(desc(subscribers.subscribedAt), asc(subscribers.id));
        const lines = [
          ["email", "name", "status", "signup_date", "confirmed_date"].join(","),
          ...rows.map((r) =>
            [
              csvCell(r.email),
              csvCell(r.name ?? ""),
              r.status,
              r.subscribedAt.toISOString().slice(0, 10),
              r.confirmedAt?.toISOString().slice(0, 10) ?? "",
            ].join(","),
          ),
        ];
        return c.body(`${lines.join("\r\n")}\r\n`, 200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="subscribers.csv"',
        });
      },
    );
}
