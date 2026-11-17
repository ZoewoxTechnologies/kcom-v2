import { formatLagosDate, lagosDate } from "@kcom/content";
import type { Capsule, CapsuleLink, DataSource, SeriesInfo } from "./data";

const MONTH_WALK = 24;
const PAST_YEARS = 8;

/** "Saturday", "14 November 2026" for a YYYY-MM-DD day. */
export function dayParts(day: string): { weekday: string; weekdayShort: string; rest: string } {
  const [weekday = "", dm = ""] = formatLagosDate(day).split(", ");
  return { weekday, weekdayShort: weekday.slice(0, 3), rest: `${dm} ${day.slice(0, 4)}` };
}

/** "14 Nov" */
export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export interface Neighbours {
  prev: CapsuleLink | null;
  next: CapsuleLink | null;
}

/**
 * The nearest published days either side of `date`, skipping days with no capsule.
 * Walks month by month (newest first within a month), at most two years either way.
 */
export async function neighbours(src: DataSource, date: string, today: string): Promise<Neighbours> {
  const month = date.slice(0, 7);
  const find = async (dir: 1 | -1) => {
    for (let i = 0; i <= MONTH_WALK; i++) {
      const m = shiftMonth(month, dir * i);
      if (dir === 1 && m > today.slice(0, 7)) return null;
      const rows = await src.listCapsules({ month: m });
      const candidates = rows.filter((c) => (dir === -1 ? c.displayDate < date : c.displayDate > date && c.displayDate <= today));
      if (candidates.length) return candidates.reduce((a, b) => ((dir === -1 ? b.displayDate > a.displayDate : b.displayDate < a.displayDate) ? b : a));
    }
    return null;
  };
  const [prev, next] = await Promise.all([find(-1), find(1)]);
  return { prev, next };
}

export interface SeriesContext {
  series: SeriesInfo;
  /** Oldest part first. */
  members: CapsuleLink[];
  total: number;
}

/** The capsule's series and its parts, or null when it has none. */
export async function seriesContext(src: DataSource, capsule: Capsule): Promise<SeriesContext | null> {
  if (!capsule.seriesId) return null;
  const series = (await src.listSeries()).find((s) => s.id === capsule.seriesId);
  if (!series) return null;
  const rows = await src.listCapsules({ series: series.slug });
  const members = [...rows].sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0) || a.displayDate.localeCompare(b.displayDate));
  return { series, members, total: members.length };
}

/** Capsules from the same calendar day in earlier years, newest first. */
export async function onThisDay(src: DataSource, date: string): Promise<CapsuleLink[]> {
  const year = Number(date.slice(0, 4));
  const days = Array.from({ length: PAST_YEARS }, (_, i) => `${year - 1 - i}${date.slice(4)}`);
  const found = await Promise.all(days.map((d) => src.listCapsules({ date: d, limit: 1 }).then((r) => r[0] ?? null)));
  return found.filter((c): c is CapsuleLink => c !== null);
}

export interface CapsulePageData extends Neighbours {
  capsule: Capsule;
  seriesInfo: SeriesContext | null;
  past: CapsuleLink[];
}

export async function loadCapsulePage(src: DataSource, capsule: Capsule, now: Date = new Date()): Promise<CapsulePageData> {
  const today = lagosDate(now);
  const [n, seriesInfo, past] = await Promise.all([
    neighbours(src, capsule.displayDate, today),
    seriesContext(src, capsule),
    onThisDay(src, capsule.displayDate),
  ]);
  return { capsule, ...n, seriesInfo, past };
}
