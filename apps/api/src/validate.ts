import { validator } from "hono/validator";
import type { z, ZodType } from "zod";
import { HttpError } from "./errors.js";

/** Validate a request part against a zod schema; failures become a 400 with issue details. */
export function validate<T extends ZodType>(target: "param" | "query" | "json", schema: T) {
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
