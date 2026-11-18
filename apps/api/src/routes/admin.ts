import { Hono } from "hono";
import type { CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { adminBlogRoutes } from "./admin-blog.js";
import { adminBookRoutes } from "./books.js";
import { adminCapsuleRoutes } from "./admin-capsules.js";
import type { CapsuleEvents } from "../capsule-publishing.js";
import { adminEventRoutes } from "./events.js";
import { adminSeriesRoutes } from "./series.js";

/**
 * Everything under /admin: signed-in Admin or Editor only (checked once here,
 * responses are `no-store`). Add new content areas with one more `.route()`;
 * their handlers use `requireCan` for finer permissions.
 */
export function adminRoutes(db: CapsuleDb, auth: Auth, events: CapsuleEvents) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "content:read"))
    .route("/blog", adminBlogRoutes(db))
    .route("/books", adminBookRoutes(db))
    .route("/capsules", adminCapsuleRoutes(db, events))
    .route("/events", adminEventRoutes(db))
    .route("/series", adminSeriesRoutes(db));
}
