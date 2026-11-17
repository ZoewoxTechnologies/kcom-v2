import { Hono } from "hono";
import type { CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { adminCapsuleRoutes } from "./admin-capsules.js";
import { adminHomepageRoutes } from "./homepage.js";
import { adminPageRoutes } from "./pages.js";
import { adminSeriesRoutes } from "./series.js";

/**
 * Everything under /admin: signed-in Admin or Editor only (checked once here,
 * responses are `no-store`). Add new content areas with one more `.route()`;
 * their handlers use `requireCan` for finer permissions.
 */
export function adminRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "content:read"))
    .route("/capsules", adminCapsuleRoutes(db))
    .route("/series", adminSeriesRoutes(db))
    .route("/pages", adminPageRoutes(db))
    .route("/homepage", adminHomepageRoutes(db));
}
