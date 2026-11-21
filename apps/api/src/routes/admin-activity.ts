import { Hono } from "hono";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { contactTopicLabels } from "@kcom/db/contact-topics";
import {
  blogPosts,
  books,
  capsules,
  contactMessages,
  events,
  pages,
  subscribers,
  type CapsuleDb,
} from "@kcom/db";
import type { AuthEnv } from "../require-permission.js";

const LIMIT = 6;

export interface ActivityItem {
  /** ISO instant the change happened. */
  at: string;
  text: string;
  /** Admin screen to open, when there is one. */
  href: string | null;
  badge: "New" | null;
}

/** Content tables that report "<kind> created/updated: <title>" from their timestamps. */
const content = [
  { kind: "Capsule", table: capsules, href: (id: string) => `/capsules/${id}` },
  { kind: "Blog post", table: blogPosts, href: (id: string) => `/blog/${id}` },
  { kind: "Event", table: events, href: () => "/events" },
  { kind: "Page", table: pages, href: () => null },
  { kind: "Book", table: books, href: () => null },
] as const;

/** First name and last initial, e.g. "Grace A."; "Someone" when no name was given. */
export function shortName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Someone";
  const [first, ...rest] = parts;
  return rest.length ? `${first} ${rest[rest.length - 1]![0]!.toUpperCase()}.` : first!;
}

/**
 * Recent changes across the site, newest first: content edits (from each
 * table's timestamps), confirmed subscribers and contact messages.
 */
export function adminActivityRoutes(db: CapsuleDb) {
  return new Hono<AuthEnv>().get("/", async (c) => {
    const fromContent = await Promise.all(
      content.map(async ({ kind, table, href }) => {
        const rows = await db
          .select({
            id: table.id,
            title: table.title,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt,
          })
          .from(table)
          .orderBy(desc(table.updatedAt))
          .limit(LIMIT);
        return rows.map((r): ActivityItem => ({
          at: r.updatedAt.toISOString(),
          text: `${kind} ${r.updatedAt.getTime() - r.createdAt.getTime() < 1000 ? "created" : "updated"}: ${r.title}`,
          href: href(r.id),
          badge: null,
        }));
      }),
    );
    const [subs, messages] = await Promise.all([
      db
        .select({ name: subscribers.name, at: subscribers.confirmedAt })
        .from(subscribers)
        .where(and(eq(subscribers.status, "confirmed"), isNotNull(subscribers.confirmedAt)))
        .orderBy(desc(subscribers.confirmedAt))
        .limit(LIMIT),
      db
        .select({
          topic: contactMessages.topic,
          status: contactMessages.status,
          at: contactMessages.createdAt,
        })
        .from(contactMessages)
        .orderBy(desc(contactMessages.createdAt))
        .limit(LIMIT),
    ]);

    const items: ActivityItem[] = [
      ...fromContent.flat(),
      ...subs.map((s): ActivityItem => ({
        at: s.at!.toISOString(),
        text: `${shortName(s.name)} subscribed`,
        href: null,
        badge: null,
      })),
      ...messages.map((m): ActivityItem => ({
        at: m.at.toISOString(),
        text: `Contact: ${contactTopicLabels[m.topic].toLowerCase()}`,
        href: "/inbox",
        badge: m.status === "new" ? "New" : null,
      })),
    ];
    items.sort((a, b) => b.at.localeCompare(a.at));
    return c.json({ items: items.slice(0, LIMIT) });
  });
}
