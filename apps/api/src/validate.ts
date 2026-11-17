import { validator } from "hono/validator";
import type { z, ZodType } from "zod";
import { HttpError } from "./errors.js";

/** Validate a request part against a zod schema; failures become a 400 with issue details. */
export function validate<Target extends "param" | "query" | "json", T extends ZodType>(target: Target, schema: T) {
  return validator(target, (value) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new HttpError(
        400,
        "invalid_request",
        `invalid ${target}`,
        result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      );
    }
    return result.data as z.output<T>;
  });
}
