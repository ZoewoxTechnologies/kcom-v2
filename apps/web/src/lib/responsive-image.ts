import { imageSrcSet, imageUrl } from "@kcom/media";

export type ResponsiveImageOptions = {
  /** Candidate widths in CSS pixels, smallest first. */
  widths: number[];
  /** Width used for the fallback `src`; defaults to the middle candidate. */
  fallbackWidth?: number;
};

export type ResponsiveImageAttrs = { src: string; srcset?: string };

/**
 * `src` and `srcset` for a stored image URL. Cloudinary uploads get resized,
 * auto-format variants; any other URL is returned as a plain `src`.
 */
export function responsiveImage(url: string, { widths, fallbackWidth }: ResponsiveImageOptions): ResponsiveImageAttrs {
  const srcset = imageSrcSet(url, widths);
  const src = imageUrl(url, { width: fallbackWidth ?? widths[Math.floor(widths.length / 2)] });
  return src === url ? { src } : { src, srcset };
}
