import { initSentry } from "./instrument.js";
import { serve } from "@hono/node-server";
import { createDb } from "@kcom/db";
import { createApp } from "./app.js";
import { parseTrustedProxyHops } from "./client-ip.js";
import { assertSignupConfig } from "./routes/subscribers.js";
import { turnstileFromEnv } from "./turnstile.js";
import { cloudinaryFromEnv } from "./uploads/cloudinary.js";

initSentry();

assertSignupConfig(
  { secret: process.env.BETTER_AUTH_SECRET, webUrl: process.env.SITE_URL },
  process.env.NODE_ENV === "production",
);

const port = Number(process.env.PORT ?? 8787);
const app = createApp(createDb(), {
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // Production stays strict: only CORS_ORIGINS. Anywhere else, any localhost port is allowed.
  allowLocalhostOrigins: process.env.NODE_ENV !== "production",
  cloudinary: cloudinaryFromEnv(),
  trustedProxyHops: parseTrustedProxyHops(process.env.TRUSTED_PROXY_HOPS),
  internalToken: process.env.INTERNAL_JOB_TOKEN || undefined,
  signup: { botCheck: turnstileFromEnv() },
  auth: {
    cookies: {
      secure: process.env.COOKIE_SECURE !== "false",
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  },
});

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
