import { monthKey } from "@kcom/content";
import type { SeriesSummary } from "./data";

export const SERIES_PAGE_SIZE = 9;
export const SERIES_CAPSULES_PAGE_SIZE = 30;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** A valid archive month that is not ahead of `current`; null otherwise. */
export function parseMonth(
  raw: string | undefined,
  current: string,
  startYear: number,
): { year: number; month: number; key: string } | null {
  const m = raw ? MONTH_RE.exec(raw) : null;
  if (!m || raw! > current || Number(m[1]) < startYear) return null;
  return { year: Number(m[1]), month: Number(m[2]), key: raw! };
}

/** Years offered in the archive, newest first. */
export function archiveYears(current: string, startYear: number): number[] {
  const last = Number(current.slice(0, 4));
  return Array.from({ length: Math.max(last - startYear + 1, 1) }, (_, i) => last - i);
}

/** The month to land on when switching to a year: December, or the current month this year. */
export function monthForYear(year: number, current: string, startYear: number): string | null {
  if (year < startYear || year > Number(current.slice(0, 4))) return null;
  const december = monthKey(year, 12);
  return december > current ? current : december;
}

export const monthPath = (key: string): string => `/capsules/month/${key}`;
export const capsulePath = (slug: string): string => `/capsules/${slug}`;
export const seriesPath = (slug: string): string => `/series/${slug}`;

export type SeriesSort = "newest" | "az" | "longest";
export const seriesSorts: readonly { value: SeriesSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "az", label: "A to Z" },
  { value: "longest", label: "Longest" },
];

export const parseSort = (raw: string | null | undefined): SeriesSort =>
  seriesSorts.find((s) => s.value === raw)?.value ?? "newest";

export function sortSeries(list: readonly SeriesSummary[], sort: SeriesSort): SeriesSummary[] {
  const by = {
    newest: (a: SeriesSummary, b: SeriesSummary) =>
      b.lastDate.localeCompare(a.lastDate) || b.firstDate.localeCompare(a.firstDate),
    az: (a: SeriesSummary, b: SeriesSummary) => a.title.localeCompare(b.title),
    longest: (a: SeriesSummary, b: SeriesSummary) =>
      b.count - a.count || a.title.localeCompare(b.title),
  }[sort];
  return [...list].sort((a, b) => by(a, b) || a.slug.localeCompare(b.slug));
}

/** Intro line for the archive pages. */
export const archiveIntro = (startYear: number): string =>
  `Every daily capsule since ${startYear}, to read and share.`;

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
