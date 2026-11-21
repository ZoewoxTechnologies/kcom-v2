import { Hono } from "hono";
import { asc } from "drizzle-orm";
import { redirects, type CapsuleDb } from "@kcom/db";
import { publicCache } from "../content/index.js";

/**
 * The whole redirect map in one response. The web server caches it, so it is read rarely;
 * it holds only old and new paths, nothing private.
 */
export function redirectRoutes(db: CapsuleDb) {
  return new Hono().use(publicCache).get("/", async (c) => {
    const rows = await db
      .select({ from: redirects.fromPath, to: redirects.toPath, status: redirects.status })
      .from(redirects)
      .orderBy(asc(redirects.fromPath));
    return c.json(rows);
  });
}
