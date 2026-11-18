import { Hono } from "hono";
import { z } from "zod";
import { imageUploadConfig } from "@kcom/media";
import { HttpError } from "../errors.js";
import { requireCan, type AuthEnv } from "../require-permission.js";
import { validate } from "../validate.js";
import { signParams, type CloudinaryConfig } from "../uploads/cloudinary.js";

const FOLDER = "kcom";
const { allowedTypes, maxBytes } = imageUploadConfig;

const signBody = z.object({
  contentType: z.string(),
  size: z.number().int().positive(),
});

/**
 * Signed direct uploads: the browser asks for a signature, then posts the file
 * straight to Cloudinary, so image bytes never pass through this API. The
 * Cloudinary upload response carries `secure_url`, `width` and `height`.
 *
 * The declared size is checked here; Cloudinary cannot enforce a size from a
 * signature alone, so also set a max file size on the account/upload policy.
 * The type is enforced by Cloudinary through the signed `allowed_formats`.
 */
export function adminUploadRoutes(cloudinary: CloudinaryConfig | undefined) {
  return new Hono<AuthEnv>().post(
    "/sign",
    requireCan("content:write"),
    validate("json", signBody),
    (c) => {
      const { contentType, size } = c.req.valid("json");
      if (!(contentType in allowedTypes)) {
        throw new HttpError(422, "unsupported_type", "only png, jpg and webp images are allowed");
      }
      if (size > maxBytes) {
        throw new HttpError(422, "file_too_large", `file must be at most ${maxBytes} bytes`);
      }
      if (!cloudinary)
        throw new HttpError(503, "uploads_unavailable", "uploads are not configured");
      const params = {
        allowed_formats: Object.values(allowedTypes).join(","),
        folder: FOLDER,
        timestamp: Math.floor(Date.now() / 1000),
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
