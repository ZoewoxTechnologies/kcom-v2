/** Africa/Lagos is UTC+1 all year (no daylight saving), so conversions are fixed-offset. */
export const LAGOS_TIME_ZONE = "Africa/Lagos";
const OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * OFFSET_MS;

export interface LagosParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export function toLagosParts(date: Date): LagosParts {
  const d = new Date(date.getTime() + OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export function fromLagosParts({ year, month, day, hour, minute }: LagosParts): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS);
}

/** "YYYY-MM-DD" of the Lagos calendar day containing the instant. */
export function lagosDateKey(date: Date): string {
  const p = toLagosParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The next 00:00 in Lagos strictly after `now`. */
export function nextLagosMidnight(now: Date): Date {
  const p = toLagosParts(now);
  return new Date(fromLagosParts({ ...p, hour: 0, minute: 0 }).getTime() + DAY_MS);
}

export function formatLagos(date: Date): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${text} WAT`;
}
