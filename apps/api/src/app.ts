import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CapsuleDb } from "@kcom/db";
import { createAuth, type AuthOptions } from "./auth.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { health } from "./routes/health.js";
import { blogRoutes } from "./routes/blog.js";
import { bookRoutes } from "./routes/books.js";
import { capsuleRoutes } from "./routes/capsules.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { homepageRoutes } from "./routes/homepage.js";
import { redirectRoutes } from "./routes/redirects.js";
import { pageRoutes } from "./routes/pages.js";
import { contactRoutes, type BotCheck } from "./routes/contact.js";
import { settingsRoutes } from "./routes/settings.js";
import { eventRoutes } from "./routes/events.js";
import { seriesRoutes } from "./routes/series.js";
import { searchRoutes } from "./routes/search.js";
import type { CloudinaryConfig } from "./uploads/cloudinary.js";
import { corsOriginPolicy, trustedOriginList } from "./origins.js";
import { userRoutes } from "./routes/users.js";
import { internalRoutes } from "./routes/internal.js";
import { mailerFromEnv, type Mailer } from "./mailer.js";
import { subscriberRoutes } from "./routes/subscribers.js";
import { createCapsuleEvents, type CapsuleEvents } from "./capsule-publishing.js";

export type AppOptions = {
  corsOrigins?: string[];
  /**
   * Also accept any http://localhost:<port> and http://127.0.0.1:<port> origin, for CORS and auth.
   * Development only, so several checkouts' sites and admins can share one API. Never set in production.
   */
  allowLocalhostOrigins?: boolean;
  auth?: AuthOptions;
  /** Subscribe to "capsule published" here; defaults to a fresh, unsubscribed bus. */
  capsuleEvents?: CapsuleEvents;
  /** Bearer token for /internal (Cloud Scheduler). Unset disables /internal. */
  internalToken?: string;
  cloudinary?: CloudinaryConfig;
  /** Trusted reverse-proxy hops in front of the API, for client-IP lookup in x-forwarded-for. Default 1. */
  trustedProxyHops?: number;
  /** Bot check for the public contact form; unset accepts every submission. */
  contactBotCheck?: BotCheck;
  /** Sends the site's email. Defaults to Resend when RESEND_API_KEY is set, else a no-op. */
  mailer?: Mailer;
  /** Public email signup. Secret and API URL default to the auth ones; webUrl to SITE_URL. */
  signup?: {
    secret?: string;
    apiUrl?: string;
    /** Public URL of the web site, where confirm and unsubscribe links redirect. */
    webUrl?: string;
    /** Bot check for the signup form (Cloudflare Turnstile); unset accepts every signup. */
    botCheck?: BotCheck;
  };
};

export function createApp(
  db: CapsuleDb,
  {
    corsOrigins = [],
    allowLocalhostOrigins = false,
    auth = {},
    capsuleEvents = createCapsuleEvents(),
    internalToken,
    cloudinary,
    trustedProxyHops,
    contactBotCheck,
    mailer = auth.mailer ?? mailerFromEnv(),
    signup = {},
  }: AppOptions = {},
) {
  const origin = corsOriginPolicy(corsOrigins, allowLocalhostOrigins);
  const publicCors = cors({ origin, allowMethods: ["GET", "HEAD", "OPTIONS"] });
  // Auth endpoints take credentialed cross-origin calls from the admin UI only.
  const authCors = cors({
    origin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  });
  // Admin endpoints take credentialed cross-origin writes from the admin UI only.
  const adminCors = cors({
    origin,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  });
  // The public contact form posts cross-origin from the web site.
  const contactCors = cors({
    origin,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  });
  const authInstance = createAuth(db, {
    trustedOrigins: trustedOriginList(corsOrigins, allowLocalhostOrigins),
    ...auth,
    mailer,
  });
  return new Hono()
    .use((c, next) =>
      c.req.path.startsWith("/api/auth/")
        ? authCors(c, next)
        : c.req.path.startsWith("/admin/") ||
            c.req.path === "/users" ||
            c.req.path.startsWith("/users/")
          ? adminCors(c, next)
          : c.req.path === "/contact" || c.req.path === "/subscribers"
            ? contactCors(c, next)
            : publicCors(c, next),
    )
    .onError(errorHandler)
    .notFound(notFoundHandler)
    .route("/", health)
    .route("/blog", blogRoutes(db))
    .route("/books", bookRoutes(db))
    .route("/capsules", capsuleRoutes(db))
    .route("/contact", contactRoutes(db, trustedProxyHops, contactBotCheck, mailer))
    .route(
      "/subscribers",
      subscriberRoutes(db, {
        secret: signup.secret ?? auth.secret ?? process.env.BETTER_AUTH_SECRET ?? "",
        apiUrl: signup.apiUrl ?? auth.baseURL ?? process.env.BETTER_AUTH_URL ?? "",
        webUrl: signup.webUrl ?? process.env.SITE_URL ?? "",
        mailer,
        botCheck: signup.botCheck,
        trustedProxyHops,
      }),
    )
    .route("/events", eventRoutes(db))
    .route("/settings", settingsRoutes(db))
    .route("/search", searchRoutes(db, trustedProxyHops))
    .route("/series", seriesRoutes(db))
    .route("/pages", pageRoutes(db))
    .route("/homepage", homepageRoutes(db))
    .route("/redirects", redirectRoutes(db))
    .route("/admin", adminRoutes(db, authInstance, capsuleEvents, cloudinary))
    .route("/internal", internalRoutes(db, capsuleEvents, internalToken))
    .route("/users", userRoutes(db, authInstance))
    .route("/api/auth", authRoutes(authInstance, trustedProxyHops));
}

export type App = ReturnType<typeof createApp>;
