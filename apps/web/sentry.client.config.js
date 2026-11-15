import * as Sentry from "@sentry/astro";

// Build-time public env. No-op when PUBLIC_SENTRY_DSN is unset.
if (import.meta.env.PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.PUBLIC_SENTRY_DSN,
    environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    // No session replay; PostHog is the only product analytics tool.
  });
}
