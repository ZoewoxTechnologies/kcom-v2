import { createApiSource, emptySource, withFallback } from "./client";
import { sampleSource } from "./sample";
import type { DataSource } from "./types";

export type { Book, Capsule, CapsuleLink, CapsuleListItem, CapsuleNeighbours, RichTextDoc, CapsuleSummary, DataSource, SeriesDetail, SeriesSummary } from "./types";

/**
 * One switch: DATA_SOURCE=sample serves built-in sample data; DATA_SOURCE=api (default)
 * reads PUBLIC_API_URL. Sample data is only a fallback outside production builds; in
 * production a failing or empty API yields null / [] so pages hide that content.
 */
export function resolveSource(env: Record<string, string | undefined>, prod: boolean): DataSource {
  const mode = env.DATA_SOURCE ?? "api";
  const url = env.PUBLIC_API_URL;
  if (mode === "sample") return sampleSource;
  if (!url) return prod ? emptySource : sampleSource;
  return withFallback(createApiSource(url), prod ? null : sampleSource, (e) => console.warn("[data] API failed:", e));
}

export const data = resolveSource({
  DATA_SOURCE: import.meta.env.DATA_SOURCE ?? process.env.DATA_SOURCE,
  PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL,
}, import.meta.env.PROD);
