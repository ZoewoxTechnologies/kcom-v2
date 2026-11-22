import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import sentry from "@sentry/astro";

// Standalone Node server: Cloud Run sets PORT; HOST=0.0.0.0 is set in the container.
// Sentry init lives in sentry.{client,server}.config.js and is a no-op without a DSN.
// Source map upload only runs when SENTRY_AUTH_TOKEN is set (CI/deploy).
// Dev port: DEV_PORT from apps/web/.env.local (set per worktree by `pnpm dev:ports`).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: defaults apply.
}

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: Number(process.env.DEV_PORT) || 4321, host: true },
  integrations: [
    sentry({
      telemetry: false,
      sourceMapsUploadOptions: {
        enabled: Boolean(process.env.SENTRY_AUTH_TOKEN),
        project: process.env.SENTRY_PROJECT,
        org: process.env.SENTRY_ORG,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
});
