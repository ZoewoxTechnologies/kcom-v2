import type { Context } from "hono";
import { and, desc, eq, gte, like } from "drizzle-orm";
import { activityLog, type ActivityAction, type CapsuleDb } from "@kcom/db";
import type { AuthEnv } from "./require-permission.js";

/** A repeat edit of the same item by the same person inside this window updates the row's time. */
export const COALESCE_MS = 10 * 60 * 1000;

type Status = "draft" | "scheduled" | "published";

/** What a status change means in the feed: leaving draft publishes, returning to draft unpublishes. */
export function actionForUpdate(before: Status, after: Status | undefined): ActivityAction {
  if (after === undefined || after === before) return "update";
  if (before === "draft") return "publish";
  return after === "draft" ? "unpublish" : "update";
}

/** The text before the first ": ", escaped for LIKE. */
const labelOf = (title: string) =>
  title.split(": ")[0]!.replace(/[\\%_]/g, (ch) => `\\${ch}`) + ": ";

export interface ActivityEntry {
  action: ActivityAction;
  /** Short kind such as "capsule" or "blog"; the feed turns it into a label. */
  entityType: string;
  entityId: string;
  title: string;
  /**
   * Only merge into a row whose title starts with the same label (the text before ": "), so
   * different things done to one item ("User invited", "User restored") keep their own rows.
   */
  sameLabel?: boolean;
}

/**
 * Records a change made by a signed-in person (ids and labels only). Call it after the write has
 * succeeded. It never fails the request: a logging error is reported and the edit stands.
 * Skipped for autosaves (`x-autosave` header). Deletes always get their own row.
 */
export async function logActivity(
  db: CapsuleDb,
  c: Context<AuthEnv>,
  entry: ActivityEntry,
  now = new Date(),
) {
  if (c.req.header("x-autosave")) return;
  const { id: userId, name } = c.var.user;
  const title = entry.title.slice(0, 200);
  try {
    if (entry.action !== "delete") {
      const [recent] = await db
        .select({ id: activityLog.id })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.userId, userId),
            eq(activityLog.entityType, entry.entityType),
            eq(activityLog.entityId, entry.entityId),
            eq(activityLog.action, entry.action),
            gte(activityLog.at, new Date(now.getTime() - COALESCE_MS)),
            entry.sameLabel ? like(activityLog.title, `${labelOf(title)}%`) : undefined,
          ),
        )
        .orderBy(desc(activityLog.at))
        .limit(1);
      if (recent) {
        await db
          .update(activityLog)
          .set({ at: now, title, userName: name })
          .where(eq(activityLog.id, recent.id));
        return;
      }
    }
    await db.insert(activityLog).values({
      userId,
      userName: name,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      title,
      at: now,
    });
  } catch (err) {
    console.error("activity log write failed", err);
  }
}
