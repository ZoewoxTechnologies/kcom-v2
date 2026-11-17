import { HttpError } from "../errors.js";

type PgError = { code?: string; cause?: unknown };

function pgError(err: unknown): PgError | undefined {
  for (let e = err as PgError | undefined, i = 0; e && i < 4; e = e.cause as PgError, i++) {
    if (typeof e.code === "string") return e;
  }
  return undefined;
}

export type WriteErrorOptions = {
  /** What the resource is called in messages, e.g. "capsule". */
  label?: string;
  /** Override the generic messages for a resource-specific rule. */
  messages?: { reference?: string; check?: string };
};

/**
 * Call in a write's `catch`: turns unique (23505 → 409), foreign-key (23503 →
 * 422) and check-constraint (23514 → 422) violations into 4xx responses.
 * Anything else is rethrown unchanged.
 */
export function rethrowWriteError(
  err: unknown,
  { label = "record", messages }: WriteErrorOptions = {},
): never {
  switch (pgError(err)?.code) {
    case "23505":
      throw new HttpError(409, "conflict", `${label} already exists`);
    case "23503":
      throw new HttpError(
        422,
        "invalid_reference",
        messages?.reference ?? "a referenced record does not exist",
      );
    case "23514":
      throw new HttpError(
        422,
        "invalid_request",
        messages?.check ?? "a field value is not allowed",
      );
  }
  throw err;
}
