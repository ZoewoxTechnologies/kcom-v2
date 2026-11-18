import { and, eq, lte } from "drizzle-orm";
import { capsules, type CapsuleDb } from "@kcom/db";

export type CapsuleRow = typeof capsules.$inferSelect;
export type CapsulePublished = { capsule: CapsuleRow };
type Handler = (event: CapsulePublished) => void | Promise<void>;

/**
 * In-process "capsule published" hook. Later features (site rebuild, email)
 * subscribe with `on`. A failing handler is logged and never blocks the publish
 * or the other handlers.
 */
export function createCapsuleEvents() {
  const handlers: Handler[] = [];
  return {
    on(handler: Handler) {
      handlers.push(handler);
    },
    async emitPublished(capsule: CapsuleRow) {
      for (const handler of handlers) {
        try {
          await handler({ capsule });
        } catch (err) {
          console.error("capsule published handler failed:", err);
        }
      }
    },
  };
}
export type CapsuleEvents = ReturnType<typeof createCapsuleEvents>;

/**
 * Publishes every scheduled capsule whose time has come and emits one event
 * per capsule. Idempotent: the update only matches rows still `scheduled`, so
 * a second or concurrent run claims nothing and emits nothing.
 */
export async function publishDueCapsules(db: CapsuleDb, events: CapsuleEvents, now = new Date()) {
  const rows = await db
    .update(capsules)
    .set({ status: "published" })
    .where(and(eq(capsules.status, "scheduled"), lte(capsules.publishAt, now)))
    .returning();
  for (const row of rows) await events.emitPublished(row);
  return rows;
}
