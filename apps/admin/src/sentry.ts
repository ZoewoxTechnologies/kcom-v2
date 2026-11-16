import * as Sentry from "@sentry/react";

/** Initialise Sentry from Vite env. No-op when VITE_SENTRY_DSN is unset. */
export function initSentry(env: Record<string, string | undefined> = import.meta.env): boolean {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT ?? env.MODE,
    release: env.VITE_SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    // No session replay for the admin app.
  });
  return true;
}
