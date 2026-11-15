import * as Sentry from "@sentry/node";

/** Initialise Sentry from env. No-op when SENTRY_DSN is unset. Returns whether it is active. */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  const dsn = env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "development",
    release: env.SENTRY_RELEASE,
    tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
  return true;
}
