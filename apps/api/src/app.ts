import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CapsuleDb } from "@kcom/db";
import { createAuth, type AuthOptions } from "./auth.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { health } from "./routes/health.js";
import { capsuleRoutes } from "./routes/capsules.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { publicBookRoutes } from "./routes/books.js";
import { userRoutes } from "./routes/users.js";

export type AppOptions = { corsOrigins?: string[]; auth?: AuthOptions };

export function createApp(db: CapsuleDb, { corsOrigins = [], auth = {} }: AppOptions = {}) {
  const publicCors = cors({ origin: corsOrigins, allowMethods: ["GET", "HEAD", "OPTIONS"] });
  // Auth endpoints take credentialed cross-origin calls from the admin UI only.
  const authCors = cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  });
  const authInstance = createAuth(db, { trustedOrigins: corsOrigins, ...auth });
  return new Hono()
    .use((c, next) =>
      c.req.path.startsWith("/api/auth/") ? authCors(c, next) : publicCors(c, next),
    )
    .onError(errorHandler)
    .notFound(notFoundHandler)
    .route("/", health)
    .route("/capsules", capsuleRoutes(db))
    .route("/books", publicBookRoutes(db))
    .route("/admin", adminRoutes(db, authInstance))
    .route("/users", userRoutes(db, authInstance))
    .route("/api/auth", authRoutes(authInstance));
}

export type App = ReturnType<typeof createApp>;
