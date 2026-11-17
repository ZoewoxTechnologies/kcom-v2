import { lagosDate } from "@kcom/content";
import type { SeriesSummary } from "./data";

/** The ministry's daily capsules begin in 2012. */
export const ARCHIVE_START_YEAR = 2012;
export const SERIES_PAGE_SIZE = 9;
export const SERIES_CAPSULES_PAGE_SIZE = 30;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The Lagos calendar month (YYYY-MM) of an instant. */
export const lagosMonth = (at: Date = new Date()): string => lagosDate(at).slice(0, 7);

/** A valid archive month that is not ahead of `current`; null otherwise. */
export function parseMonth(raw: string | undefined, current: string): { year: number; month: number; key: string } | null {
  const m = raw ? MONTH_RE.exec(raw) : null;
  if (!m || raw! > current || Number(m[1]) < ARCHIVE_START_YEAR) return null;
  return { year: Number(m[1]), month: Number(m[2]), key: raw! };
}

export const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, "0")}`;
export const monthName = (month: number): string => monthNames[month - 1]!;
export const monthShort = (month: number): string => monthNames[month - 1]!.slice(0, 3);
export const monthLabel = (key: string): string => `${monthName(Number(key.slice(5)))} ${key.slice(0, 4)}`;

/** Previous or next month key (YYYY-MM). */
export function shiftMonth(key: string, by: 1 | -1): string {
  const total = Number(key.slice(0, 4)) * 12 + (Number(key.slice(5)) - 1) + by;
  return monthKey(Math.floor(total / 12), (total % 12) + 1);
}

/** Years offered in the archive, newest first. */
export function archiveYears(current: string): number[] {
  const last = Number(current.slice(0, 4));
  return Array.from({ length: last - ARCHIVE_START_YEAR + 1 }, (_, i) => last - i);
}

/** The month to land on when switching to a year: December, or the current month this year. */
export function monthForYear(year: number, current: string): string | null {
  if (year < ARCHIVE_START_YEAR || year > Number(current.slice(0, 4))) return null;
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
    newest: (a: SeriesSummary, b: SeriesSummary) => b.lastDate.localeCompare(a.lastDate) || b.firstDate.localeCompare(a.firstDate),
    az: (a: SeriesSummary, b: SeriesSummary) => a.title.localeCompare(b.title),
    longest: (a: SeriesSummary, b: SeriesSummary) => b.count - a.count || a.title.localeCompare(b.title),
  }[sort];
  return [...list].sort((a, b) => by(a, b) || a.slug.localeCompare(b.slug));
}

/** A 1-based page request (garbage counts as page 1) clamped into range. */
export function paginate<T>(items: readonly T[], rawPage: string | null | undefined, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const asked = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;
  return { page, pages, items: items.slice((page - 1) * size, page * size) };
}

/** Page numbers to show with gaps as null: 1 … 4 5 6 … 21. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}

/** "Nov 2026" for a Lagos day (YYYY-MM-DD). */
export const shortMonthYear = (day: string): string => `${monthShort(Number(day.slice(5, 7)))} ${day.slice(0, 4)}`;

export const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/** Weekday abbreviation (SAT) and day of month for a Lagos day. */
export function dayParts(day: string): { dow: string; n: number } {
  const d = new Date(`${day}T12:00:00Z`);
  return { dow: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase(), n: d.getUTCDate() };
}
