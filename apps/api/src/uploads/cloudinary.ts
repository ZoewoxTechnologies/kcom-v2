import { createHash } from "node:crypto";

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

/** Reads Cloudinary settings from env; undefined when not fully configured. */
export function cloudinaryFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CloudinaryConfig | undefined {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = env;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : undefined;
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
