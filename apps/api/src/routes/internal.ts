import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { CapsuleDb } from "@kcom/db";
import { HttpError } from "../errors.js";
import { publishDueCapsules, type CapsuleEvents } from "../capsule-publishing.js";

function sameToken(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Machine-to-machine endpoints for Cloud Scheduler. Guarded by a shared bearer
 * token; with no token configured they are disabled (404).
 */
export function internalRoutes(db: CapsuleDb, events: CapsuleEvents, token?: string) {
  const guard = createMiddleware(async (c, next) => {
    if (!token) throw new HttpError(404, "not_found", "not found");
    const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!sameToken(given, token)) throw new HttpError(401, "unauthorized", "invalid token");
    c.header("Cache-Control", "no-store");
    await next();
  });
  return new Hono().use(guard).post("/publish-due", async (c) => {
    const published = await publishDueCapsules(db, events);
    return c.json({ published: published.map((r) => r.slug) });
  });
}
