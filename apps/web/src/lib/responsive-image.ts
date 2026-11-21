import { imageUrl } from "@kcom/media";

export type ResponsiveImageOptions = {
  /** Candidate widths in CSS pixels, smallest first. */
  widths: number[];
  /** Width used for the fallback `src`; defaults to the middle candidate. */
  fallbackWidth?: number;
  /** Width / height. Crops (`c_fill`) each variant to this ratio so cropped-away pixels are never downloaded. */
  ratio?: number;
};

export type ResponsiveImageAttrs = { src: string; srcset?: string };

/**
 * `src` and `srcset` for a stored image URL. Cloudinary uploads get resized,
 * auto-format variants; any other URL is returned as a plain `src`.
 */
export function responsiveImage(url: string, { widths, fallbackWidth, ratio }: ResponsiveImageOptions): ResponsiveImageAttrs {
  const variant = (w: number) => imageUrl(url, ratio ? { width: w, height: w / ratio, fit: "fill" } : { width: w });
  const srcset = widths.map((w) => `${variant(w)} ${w}w`).join(", ");
  const src = variant(fallbackWidth ?? widths[Math.floor(widths.length / 2)]);
  return src === url ? { src } : { src, srcset };
}
