import { Hono } from "hono";
import type { CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { adminBlogRoutes } from "./admin-blog.js";
import { adminCapsuleRoutes } from "./admin-capsules.js";
import { adminSeriesRoutes } from "./series.js";
import { adminUploadRoutes } from "./admin-uploads.js";
import type { CloudinaryConfig } from "../uploads/cloudinary.js";

/**
 * Everything under /admin: signed-in Admin or Editor only (checked once here,
 * responses are `no-store`). Add new content areas with one more `.route()`;
 * their handlers use `requireCan` for finer permissions.
 */
export function adminRoutes(db: CapsuleDb, auth: Auth, cloudinary?: CloudinaryConfig) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "content:read"))
    .route("/blog", adminBlogRoutes(db))
    .route("/capsules", adminCapsuleRoutes(db))
    .route("/series", adminSeriesRoutes(db))
    .route("/uploads", adminUploadRoutes(cloudinary));
}
