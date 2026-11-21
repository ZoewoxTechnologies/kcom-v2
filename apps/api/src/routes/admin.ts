import { Hono } from "hono";
import type { CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { adminBlogRoutes } from "./admin-blog.js";
import { adminBookRoutes } from "./books.js";
import { adminCapsuleRoutes } from "./admin-capsules.js";
import { adminHomepageRoutes } from "./homepage.js";
import { adminPageRoutes } from "./pages.js";
import type { CapsuleEvents } from "../capsule-publishing.js";
import { adminEventRoutes } from "./events.js";
import { adminSeriesRoutes } from "./series.js";
import { adminContactRoutes } from "./admin-contact.js";
import { adminUploadRoutes } from "./admin-uploads.js";
import { adminSettingsRoutes } from "./settings.js";
import type { CloudinaryConfig } from "../uploads/cloudinary.js";

/**
 * Everything under /admin: signed-in Admin or Editor only (checked once here,
 * responses are `no-store`). Add new content areas with one more `.route()`;
 * their handlers use `requireCan` for finer permissions.
 */
export function adminRoutes(
  db: CapsuleDb,
  auth: Auth,
  events: CapsuleEvents,
  cloudinary?: CloudinaryConfig,
) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "content:read"))
    .route("/blog", adminBlogRoutes(db))
    .route("/books", adminBookRoutes(db))
    .route("/capsules", adminCapsuleRoutes(db, events))
    .route("/events", adminEventRoutes(db))
    .route("/series", adminSeriesRoutes(db))
    .route("/pages", adminPageRoutes(db))
    .route("/homepage", adminHomepageRoutes(db))
    .route("/settings", adminSettingsRoutes(db))
    .route("/contact-messages", adminContactRoutes(db))
    .route("/uploads", adminUploadRoutes(cloudinary));
}
