/** Image upload rules, shared so the API and the admin UI agree. */
export const imageUploadConfig = {
  /** Allowed upload types, mapped to the file extension Cloudinary expects. */
  allowedTypes: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" },
  /** Largest accepted file, in bytes. */
  maxBytes: 5 * 1024 * 1024,
} as const;

export type ImageContentType = keyof typeof imageUploadConfig.allowedTypes;

export type ImageTransform = {
  width?: number;
  height?: number;
  /** "limit" never upscales and keeps the aspect ratio; "fill" crops to exact size. */
  fit?: "limit" | "fill";
  /** Output format; "auto" lets Cloudinary pick the best one per browser. */
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  quality?: "auto" | number;
};

const CLOUDINARY_HOST = "res.cloudinary.com";
const MARKER = "/image/upload/";

/** True for an https Cloudinary image delivery URL (exact host match). */
export function isCloudinaryImageUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === CLOUDINARY_HOST && u.pathname.includes(MARKER);
  } catch {
    return false;
  }
}

/**
 * Builds a resized/reformatted delivery URL from a stored Cloudinary URL.
 * URLs that are not Cloudinary uploads are returned unchanged.
 */
export function imageUrl(url: string, t: ImageTransform = {}): string {
  if (!isCloudinaryImageUrl(url)) return url;
  const i = url.indexOf(MARKER);
  const parts: string[] = [];
  if (t.width || t.height) parts.push(`c_${t.fit ?? "limit"}`);
  if (t.width) parts.push(`w_${Math.round(t.width)}`);
  if (t.height) parts.push(`h_${Math.round(t.height)}`);
  parts.push(`f_${t.format ?? "auto"}`, `q_${t.quality ?? "auto"}`);
  const head = url.slice(0, i + MARKER.length);
  return `${head}${parts.join(",")}/${url.slice(i + MARKER.length)}`;
}

/** `srcset` string for responsive images, one entry per width. */
export function imageSrcSet(url: string, widths: number[], t: Omit<ImageTransform, "width"> = {}) {
  return widths.map((w) => `${imageUrl(url, { ...t, width: w })} ${w}w`).join(", ");
}
