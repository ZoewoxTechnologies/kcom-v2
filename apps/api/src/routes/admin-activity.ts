import { Hono } from "hono";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { UserRole } from "@kcom/permissions";
import { contactTopicLabels } from "@kcom/db/contact-topics";
import {
  activityLog,
  contactMessages,
  subscribers,
  type ActivityAction,
  type CapsuleDb,
} from "@kcom/db";
import { can } from "../permissions.js";
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

/** How the feed names each kind of change and where it links; deleted items never link. */
const kinds: Record<
  string,
  { label: string; href: (id: string) => string | null; whole?: boolean }
> = {
  capsule: { label: "Capsule", href: (id) => `/capsules/${id}` },
  blog: { label: "Blog post", href: (id) => `/blog/${id}` },
  event: { label: "Event", href: () => "/events" },
  page: { label: "Page", href: () => null },
  book: { label: "Book", href: () => null },
  series: { label: "Series", href: () => null },
  // These carry their whole description in the title ("User role changed: G. A.").
  user: { label: "User", href: () => null, whole: true },
  settings: { label: "Settings", href: () => null, whole: true },
  homepage: { label: "Homepage", href: () => "/homepage", whole: true },
};
const verbs: Record<ActivityAction, string> = {
  create: "created",
  update: "updated",
  publish: "published",
  unpublish: "unpublished",
  delete: "deleted",
};

/** First name and last initial, e.g. "Grace A."; "Someone" when no name was given. */
export function shortName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Someone";
  const [first, ...rest] = parts;
  return rest.length ? `${first} ${rest[rest.length - 1]![0]!.toUpperCase()}.` : first!;
}

/** Contact rows open the inbox only for roles that may read it. */
export const contactHref = (role: UserRole): string | null =>
  can(role, "inbox:read") ? "/inbox" : null;

/**
 * Recent changes, newest first: the newest admin changes from the activity log (with who made
 * them), confirmed subscribers and contact messages.
 */
export function adminActivityRoutes(db: CapsuleDb) {
  return new Hono<AuthEnv>().get("/", async (c) => {
    const { role } = c.var.user;
    const [logged, subs, messages] = await Promise.all([
      db.select().from(activityLog).orderBy(desc(activityLog.at)).limit(LIMIT),
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
        .where(can(role, "prayer:read") ? undefined : eq(contactMessages.keepPrivate, false))
        .orderBy(desc(contactMessages.createdAt))
        .limit(LIMIT),
    ]);

    const items: ActivityItem[] = [
      ...logged.map((r): ActivityItem => {
        const kind = kinds[r.entityType];
        return {
          at: r.at.toISOString(),
          text: kind?.whole
            ? `${shortName(r.userName)}: ${r.title}`
            : `${shortName(r.userName)} ${verbs[r.action]} ${(kind?.label ?? r.entityType).toLowerCase()}: ${r.title}`,
          href: r.action === "delete" ? null : (kind?.href(r.entityId) ?? null),
          badge: null,
        };
      }),
      ...subs.map((s): ActivityItem => ({
        at: s.at!.toISOString(),
        text: `${shortName(s.name)} subscribed`,
        href: null,
        badge: null,
      })),
      ...messages.map((m): ActivityItem => ({
        at: m.at.toISOString(),
        text: `Contact: ${contactTopicLabels[m.topic].toLowerCase()}`,
        href: contactHref(role),
        badge: m.status === "new" ? "New" : null,
      })),
    ];
    items.sort((a, b) => b.at.localeCompare(a.at));
    return c.json({ items: items.slice(0, LIMIT) });
  });
}
