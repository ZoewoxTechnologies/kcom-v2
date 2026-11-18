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

/** A lagosDate string (YYYY-MM-DD) as "14 Nov". */
export function formatLagosShortDate(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
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
