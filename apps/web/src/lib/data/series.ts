import { lagosDate } from "@kcom/content";
import type { CapsuleListItem, SeriesSummary } from "./types";

/** A series as the public API returns it, with its live-capsule summary. */
export interface ApiSeries {
  slug: string;
  title: string;
  description: string | null;
  capsuleCount: number;
  firstDate: string;
  lastDate: string;
  latestPart: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The API's series figures plus whether the series is still running (latest part today or yesterday, Lagos). */
export function toSeriesSummary(s: ApiSeries, now: Date = new Date()): SeriesSummary {
  return {
    slug: s.slug,
    title: s.title,
    description: s.description,
    count: s.capsuleCount,
    firstDate: s.firstDate,
    lastDate: s.lastDate,
    inProgress: s.lastDate >= lagosDate(new Date(now.getTime() - DAY_MS)),
    latestPart: s.latestPart ?? s.capsuleCount,
  };
}

/** Day 1 first: by part number when present, else by date. */
export function inSeriesOrder<T extends Pick<CapsuleListItem, "displayDate" | "partNumber">>(
  capsules: readonly T[],
): T[] {
  return [...capsules].sort(
    (a, b) =>
      (a.partNumber ?? Infinity) - (b.partNumber ?? Infinity) ||
      a.displayDate.localeCompare(b.displayDate),
  );
}

export type SeriesOrder = "oldest" | "newest";

/** `?order=newest` shows the latest day first; anything else (or nothing) is Day 1 first. */
export const parseOrder = (raw: string | null | undefined): SeriesOrder =>
  raw === "newest" ? "newest" : "oldest";

/** The capsules in the chosen order; `capsules` must already be in series order (Day 1 first). */
export const inOrder = <T>(capsules: readonly T[], order: SeriesOrder): T[] =>
  order === "newest" ? [...capsules].reverse() : [...capsules];
