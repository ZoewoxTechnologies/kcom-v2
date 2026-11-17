import { lagosDate } from "@kcom/content";
import type { CapsuleListItem, SeriesSummary } from "./types";

export interface SeriesInfo {
  slug: string;
  title: string;
  description: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Summarises a series from its live capsules (any order); null when it has none. */
export function summarizeSeries(
  info: SeriesInfo,
  capsules: readonly Pick<CapsuleListItem, "displayDate" | "partNumber">[],
  now: Date = new Date(),
): SeriesSummary | null {
  if (capsules.length === 0) return null;
  const days = capsules.map((c) => c.displayDate).sort();
  const lastDate = days[days.length - 1]!;
  const yesterday = lagosDate(new Date(now.getTime() - DAY_MS));
  const highest = Math.max(0, ...capsules.map((c) => c.partNumber ?? 0));
  return {
    slug: info.slug,
    title: info.title,
    description: info.description,
    count: capsules.length,
    firstDate: days[0]!,
    lastDate,
    inProgress: lastDate >= yesterday,
    latestPart: highest || capsules.length,
  };
}

/** Day 1 first: by part number when present, else by date. */
export function inSeriesOrder<T extends Pick<CapsuleListItem, "displayDate" | "partNumber">>(capsules: readonly T[]): T[] {
  return [...capsules].sort(
    (a, b) => (a.partNumber ?? Infinity) - (b.partNumber ?? Infinity) || a.displayDate.localeCompare(b.displayDate),
  );
}
