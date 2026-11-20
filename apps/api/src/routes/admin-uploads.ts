import { Hono } from "hono";
import { z } from "zod";
import { imageUploadConfig } from "@kcom/media";
import { HttpError } from "../errors.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";
import { signParams, type CloudinaryConfig } from "../uploads/cloudinary.js";

const { allowedTypes, maxBytes } = imageUploadConfig;

/** Signing requests allowed per user per window. */
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

const signBody = z.strictObject({
  contentType: z.enum(Object.keys(allowedTypes) as [string, ...string[]]),
  size: z.number().int().positive(),
});

/**
 * Signed direct uploads: the browser asks for a signature, then posts the file
 * straight to Cloudinary, so image bytes never pass through this API. The
 * Cloudinary upload response carries `secure_url`, `width` and `height`.
 *
 * The signed `upload_preset` (created in Cloudinary, signed mode) is what
 * enforces folder, allowed formats and maximum file size; the browser cannot
 * change them. The declared type and size are also checked here for fast
 * feedback. `context` records which user uploaded the asset.
 */
export function adminUploadRoutes(cloudinary: CloudinaryConfig | undefined) {
  const hits = new Map<string, number[]>();
  const limited = (userId: string, now: number) => {
    const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
    recent.push(now);
    hits.set(userId, recent);
    return recent.length > RATE_LIMIT.max;
  };
  // Drop users with no recent hits so the map cannot grow without bound.
  const sweep = (now: number) => {
    for (const [id, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(id);
    }
  };

  return new Hono<AuthEnv>().post(
    "/sign",
    requireCan("content:write"),
    validate("json", signBody),
    (c) => {
      const { size } = c.req.valid("json");
      if (size > maxBytes) {
        throw new HttpError(422, "file_too_large", `file must be at most ${maxBytes} bytes`);
      }
      if (!cloudinary) {
        throw new HttpError(503, "uploads_unavailable", "uploads are not configured");
      }
      const now = Date.now();
      sweep(now);
      if (limited(c.var.user.id, now)) {
        c.header("Retry-After", String(Math.ceil(RATE_LIMIT.windowMs / 1000)));
        throw new HttpError(429, "rate_limited", "too many upload requests, try again shortly");
      }
      const params = {
        context: `uploaded_by=${c.var.user.id}`,
        timestamp: Math.floor(now / 1000),
        upload_preset: cloudinary.uploadPreset,
      };
      return c.json({
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
        apiKey: cloudinary.apiKey,
        signature: signParams(params, cloudinary.apiSecret),
        params,
        maxBytes,
      });
    },
  );
}
