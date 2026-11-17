/**
 * Africa/Lagos is UTC+1 all year (no daylight saving), so local midnight is
 * always 23:00 UTC the previous day.
 */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The next midnight in Africa/Lagos strictly after `now`. */
export function nextLagosMidnight(now: Date = new Date()): Date {
  const local = now.getTime() + LAGOS_OFFSET_MS;
  const nextLocalMidnight = (Math.floor(local / DAY_MS) + 1) * DAY_MS;
  return new Date(nextLocalMidnight - LAGOS_OFFSET_MS);
}

/** The calendar day (YYYY-MM-DD) of an instant in Africa/Lagos. */
export function lagosDate(at: Date): string {
  return new Date(at.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** A lagosDate string (YYYY-MM-DD) as "Saturday, 14 November". */
export function formatLagosDate(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  return `${part({ weekday: "long" })}, ${part({ day: "numeric" })} ${part({ month: "long" })}`;
}

/**
 * Turns a title or legacy path segment into a valid capsule slug: lowercase
 * ASCII words separated by hyphens. Accents are stripped; returns "" when
 * nothing usable remains (the caller must then supply a fallback).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** [from, to) instants covering one Lagos calendar day (`date` is YYYY-MM-DD). */
export function lagosDayRange(date: string): [Date, Date] {
  const from = new Date(`${date}T00:00:00+01:00`);
  return [from, new Date(from.getTime() + DAY_MS)];
}

/** [from, to) instants covering one Lagos calendar month (`month` is YYYY-MM). */
export function lagosMonthRange(month: string): [Date, Date] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return [new Date(`${month}-01T00:00:00+01:00`), new Date(`${next}-01T00:00:00+01:00`)];
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The Lagos calendar month (YYYY-MM) of an instant. */
export function lagosMonth(at: Date = new Date()): string {
  return lagosDate(at).slice(0, 7);
}

/** YYYY-MM from a year and a 1-based month. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Month name for a 1-based month: "November". */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1]!;
}

/** "Nov" for a 1-based month. */
export function monthShort(month: number): string {
  return monthName(month).slice(0, 3);
}

/** "November 2026" for a YYYY-MM key. */
export function monthLabel(key: string): string {
  return `${monthName(Number(key.slice(5)))} ${key.slice(0, 4)}`;
}

/** "Nov 2026" for a lagosDate string (YYYY-MM-DD). */
export function shortMonthYear(day: string): string {
  return `${monthShort(Number(day.slice(5, 7)))} ${day.slice(0, 4)}`;
}

/** The previous (-1) or next (+1) month key. */
export function shiftMonth(key: string, by: 1 | -1): string {
  const total = Number(key.slice(0, 4)) * 12 + (Number(key.slice(5)) - 1) + by;
  return monthKey(Math.floor(total / 12), (total % 12) + 1);
}

/** Weekday abbreviation ("SAT") and day of the month for a lagosDate string. */
export function dayParts(day: string): { dow: string; n: number } {
  const d = new Date(`${day}T12:00:00Z`);
  return { dow: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase(), n: d.getUTCDate() };
}
