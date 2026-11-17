import { and, eq, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { slug } from "@kcom/content";
import { can } from "../permissions.js";
import { HttpError } from "../errors.js";
import type { AuthedUser } from "../require-permission.js";

export const idParam = z.object({ id: z.uuid() });
export const slugParam = z.object({ slug });

export const publishStatus = z.enum(["draft", "scheduled", "published"]);
export const richText = z.record(z.string(), z.unknown());
export const httpUrl = z.url().refine((u) => /^https?:\/\//.test(u), "must be an http(s) URL");

/** Public visibility: published, and its publish_at (if any) has passed. */
export const isLive = (t: { status: PgColumn; publishAt: PgColumn }): SQL =>
  and(eq(t.status, "published"), or(isNull(t.publishAt), lte(t.publishAt, sql`now()`)))!;

/** Moving content into (or editing it while in) a non-draft state needs the publish permission. */
export function requirePublishRight(user: AuthedUser, status: string | undefined) {
  if (status && status !== "draft" && !can(user.role, "content:publish")) {
    throw new HttpError(403, "forbidden", "you do not have permission to publish");
  }
}

export const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export function notFound(what: string): never {
  throw new HttpError(404, "not_found", `${what} not found`);
}

export function conflictOnDuplicateSlug(err: unknown): never {
  if (isUniqueViolation(err)) throw new HttpError(409, "conflict", "slug already in use");
  throw err;
}
