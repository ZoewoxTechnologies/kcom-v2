import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CapsuleDb } from "@kcom/db";
import { errorHandler, notFoundHandler } from "./errors.js";
import { health } from "./routes/health.js";
import { capsuleRoutes } from "./routes/capsules.js";

export type AppOptions = { corsOrigins?: string[] };

export function createApp(db: CapsuleDb, { corsOrigins = [] }: AppOptions = {}) {
  return new Hono()
    .use(cors({ origin: corsOrigins, allowMethods: ["GET", "HEAD", "OPTIONS"] }))
    .onError(errorHandler)
    .notFound(notFoundHandler)
    .route("/", health)
    .route("/capsules", capsuleRoutes(db));
}

export type App = ReturnType<typeof createApp>;
