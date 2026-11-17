import { createApiSource, withFallback } from "./client";
import { sampleSource } from "./sample";
import type { DataSource } from "./types";

export type { CapsuleSummary, DataSource, SeriesSummary } from "./types";

/**
 * One switch: DATA_SOURCE=sample serves built-in sample data only; DATA_SOURCE=api
 * (default) reads PUBLIC_API_URL and falls back to sample data when it is unreachable.
 */
export function resolveSource(env: Record<string, string | undefined>): DataSource {
  const mode = env.DATA_SOURCE ?? "api";
  const url = env.PUBLIC_API_URL;
  if (mode === "sample" || !url) return sampleSource;
  return withFallback(createApiSource(url), sampleSource, (e) => console.warn("[data] using sample data:", e));
}

export const data = resolveSource({
  DATA_SOURCE: import.meta.env.DATA_SOURCE ?? process.env.DATA_SOURCE,
  PUBLIC_API_URL: import.meta.env.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL,
});
