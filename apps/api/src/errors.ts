import type { Context } from "hono";
import * as Sentry from "@sentry/node";

/** The single JSON shape every error response uses. */
export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorBody(code: string, message: string, details?: unknown): ApiError {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

export function notFoundHandler(c: Context) {
  c.header("Cache-Control", "no-store");
  return c.json(errorBody("not_found", "not found"), 404);
}

export function errorHandler(err: Error, c: Context) {
  c.header("Cache-Control", "no-store");
  // 503 is a deliberate, non-reported "not available" (e.g. missing config).
  if (err instanceof HttpError && (err.status < 500 || err.status === 503)) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  Sentry.captureException(err);
  console.error("unhandled error:", err);
  return c.json(errorBody("internal_error", "internal error"), 500);
}
