import type { Context } from "hono";
import { HttpError } from "../errors.js";
import { assertCan, type AuthEnv } from "../require-permission.js";

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);

/**
 * The one rule for who may publish: any change to non-draft content, or moving
 * content out of draft, needs `content:publish`. Draft-only edits need just
 * `content:write`. Pass `existing` = null when creating, `next` = undefined
 * when the status is not being set (a delete, or a patch without status).
 */
export function assertCanChange(
  c: Context<AuthEnv>,
  existing: "draft" | "scheduled" | "published" | null,
  next?: "draft" | "scheduled" | "published",
) {
  if ((existing !== null && existing !== "draft") || (next !== undefined && next !== "draft")) {
    assertCan(c, "content:publish");
  }
}
