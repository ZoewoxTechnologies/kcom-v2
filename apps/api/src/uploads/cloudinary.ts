import { createHash } from "node:crypto";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Optional name of a signed upload preset (folder, allowed formats, max size) set up in Cloudinary. */
  uploadPreset?: string;
};

/** Reads Cloudinary settings from env; undefined when not fully configured. */
export function cloudinaryFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CloudinaryConfig | undefined {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;
  return cloudName && apiKey && apiSecret
    ? { cloudName, apiKey, apiSecret, ...(uploadPreset ? { uploadPreset } : {}) }
    : undefined;
}

/** Cloudinary's signature: SHA-1 of the sorted `k=v` params joined by `&`, plus the secret. */
export function signParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}
