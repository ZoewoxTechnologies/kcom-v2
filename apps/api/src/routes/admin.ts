import { Hono } from "hono";
import type { CapsuleDb } from "@kcom/db";
import type { Auth } from "../auth.js";
import { requirePermission, type AuthEnv } from "../require-permission.js";
import { adminBookRoutes } from "./books.js";

/**
 * Everything under /admin. The sign-in and role check runs once here, so
 * resource routers mounted below only handle their own logic. Responses are
 * never cached (the guard sets no-store).
 */
export function adminRoutes(db: CapsuleDb, auth: Auth) {
  return new Hono<AuthEnv>()
    .use(requirePermission(auth, "content:write"))
    .route("/books", adminBookRoutes(db));
}
