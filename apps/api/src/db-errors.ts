import { HttpError } from "./errors.js";

type PgError = { code?: string; constraint?: string; cause?: unknown };

function pgError(err: unknown): PgError | undefined {
  for (let e = err as PgError | undefined, i = 0; e && i < 4; e = e.cause as PgError, i++) {
    if (typeof e.code === "string") return e;
  }
  return undefined;
}

/** Translates the database errors a write can raise into 4xx responses. */
export function rethrowWriteError(err: unknown, what: string): never {
  const pg = pgError(err);
  if (pg?.code === "23505") throw new HttpError(409, "conflict", `${what} slug already exists`);
  if (pg?.code === "23503") throw new HttpError(422, "invalid_reference", "series does not exist");
  if (pg?.code === "23514") {
    throw new HttpError(422, "invalid_request", "part number needs a series");
  }
  throw err;
}
