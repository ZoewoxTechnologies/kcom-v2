import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CapsuleDb } from "@kcom/db";
import { createAuth, type AuthOptions } from "./auth.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { health } from "./routes/health.js";
import { blogRoutes } from "./routes/blog.js";
import { capsuleRoutes } from "./routes/capsules.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { seriesRoutes } from "./routes/series.js";
import { userRoutes } from "./routes/users.js";
import { internalRoutes } from "./routes/internal.js";
import { createCapsuleEvents, type CapsuleEvents } from "./capsule-publishing.js";

export type AppOptions = {
  corsOrigins?: string[];
  auth?: AuthOptions;
  /** Subscribe to "capsule published" here; defaults to a fresh, unsubscribed bus. */
  capsuleEvents?: CapsuleEvents;
  /** Bearer token for /internal (Cloud Scheduler). Unset disables /internal. */
  internalToken?: string;
};

export function createApp(
  db: CapsuleDb,
  {
    corsOrigins = [],
    auth = {},
    capsuleEvents = createCapsuleEvents(),
    internalToken,
  }: AppOptions = {},
) {
  const publicCors = cors({ origin: corsOrigins, allowMethods: ["GET", "HEAD", "OPTIONS"] });
  // Auth endpoints take credentialed cross-origin calls from the admin UI only.
  const authCors = cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  });
  // Admin endpoints take credentialed cross-origin writes from the admin UI only.
  const adminCors = cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  });
  const authInstance = createAuth(db, { trustedOrigins: corsOrigins, ...auth });
  return new Hono()
    .use((c, next) =>
      c.req.path.startsWith("/api/auth/")
        ? authCors(c, next)
        : c.req.path.startsWith("/admin/")
          ? adminCors(c, next)
          : publicCors(c, next),
    )
    .onError(errorHandler)
    .notFound(notFoundHandler)
    .route("/", health)
    .route("/blog", blogRoutes(db))
    .route("/capsules", capsuleRoutes(db))
    .route("/series", seriesRoutes(db))
    .route("/admin", adminRoutes(db, authInstance, capsuleEvents))
    .route("/internal", internalRoutes(db, capsuleEvents, internalToken))
    .route("/users", userRoutes(db, authInstance))
    .route("/api/auth", authRoutes(authInstance));
}

export type App = ReturnType<typeof createApp>;
