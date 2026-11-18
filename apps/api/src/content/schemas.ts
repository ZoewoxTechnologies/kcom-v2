import { z } from "zod";
import { slug } from "@kcom/content";
import { isCloudinaryImageUrl } from "@kcom/media";

export const idParam = z.object({ id: z.uuid() });
export const slugParam = z.object({ slug });
export const publishStatus = z.enum(["draft", "scheduled", "published"]);

/** An http(s) URL only; rejects javascript:, data: and friends. */
export const httpUrl = z.url().refine((u) => /^https?:\/\//i.test(u), "must be an http(s) URL");

/**
 * A Cloudinary image delivery URL (exact host); the only kind of stored image
 * URL. Pinned to our own cloud name (CLOUDINARY_CLOUD_NAME) whenever it is set,
 * which it is wherever uploads work.
 */
export const cloudinaryImageUrl = z
  .string()
  .max(2000)
  .refine(
    (u) => isCloudinaryImageUrl(u, process.env.CLOUDINARY_CLOUD_NAME || undefined),
    "must be a Cloudinary image URL for this account",
  );

/** `limit` (1-100) and `offset` query parameters. */
export const pagination = (defaultLimit = 50) => ({
  limit: z.coerce.number().int().min(1).max(100).default(defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});
