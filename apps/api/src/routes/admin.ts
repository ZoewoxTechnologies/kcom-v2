import { Hono } from "hono";
import type { CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { adminBlogRoutes } from "./blog.js";

/**
 * Everything under /admin: sign-in and an Admin or Editor role are checked once
 * here (responses are no-store). Resource routers mount below it.
 */
export function adminRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "content:write"))
    .route("/blog", adminBlogRoutes(db));
}
