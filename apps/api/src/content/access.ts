import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { CapsuleDb } from "@kcom/db";
import { HttpError } from "../errors.js";
import { assertCan, type AuthEnv } from "../require-permission.js";

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);

/**
 * The one rule for who may publish: any change to non-draft content, or moving
 * content out of draft, needs `content:publish`. Draft-only edits need just
 * `content:write`. Setting a publish time also needs `content:publish`. Pass
 * `existing` = null when creating, `next` = undefined when the status is not
 * being set (a delete, or a patch without status), and `publishAt` only when
 * the request sets one (leave it undefined otherwise).
 */
export function assertCanChange(
  c: Context<AuthEnv>,
  existing: "draft" | "scheduled" | "published" | null,
  next?: "draft" | "scheduled" | "published",
  publishAt?: unknown,
) {
  if (
    (existing !== null && existing !== "draft") ||
    (next !== undefined && next !== "draft") ||
    publishAt !== undefined
  ) {
    assertCan(c, "content:publish");
  }
}

/** Cacheable public responses; errors still get `no-store` from the error handler. */
export const publicCache = createMiddleware(async (c, next) => {
  c.header("Cache-Control", "public, max-age=60");
  await next();
});

/** The row with this id, or a 404 naming `label`. */
export async function findById<T extends PgTable & { id: AnyPgColumn }>(
  db: CapsuleDb,
  table: T,
  id: string,
  label: string,
): Promise<T["$inferSelect"]> {
  const [row] = await db
    .select()
    .from(table as PgTable)
    .where(eq(table.id, id))
    .limit(1);
  if (!row) throw notFound(label);
  return row as T["$inferSelect"];
}
