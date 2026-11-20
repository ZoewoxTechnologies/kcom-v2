import { DEFAULT_TIME_ZONE, fromZoneParts, zoneDateKey } from "@kcom/ui";

/** Capsule days are Africa/Lagos calendar days; a capsule goes live at 00:00 Lagos. */
export const CAPSULE_ZONE = DEFAULT_TIME_ZONE;

/** "YYYY-MM-DD" */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number): DayKey => `${y}-${pad(m)}-${pad(d)}`;
const parse = (k: DayKey) => {
  const [y, m, d] = k.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
};

/** The Lagos day an instant falls on. */
export const lagosDay = (instant: Date | string): DayKey =>
  zoneDateKey(new Date(instant), CAPSULE_ZONE);

/** The instant a capsule scheduled for this Lagos day goes live: 00:00 in Lagos. */
export function lagosMidnight(day: DayKey): Date {
  const { y, m, d } = parse(day);
  return fromZoneParts({ year: y, month: m, day: d, hour: 0, minute: 0 }, CAPSULE_ZONE);
}

/** A day can take a rescheduled capsule only if its midnight has not passed yet. */
export const canScheduleOn = (day: DayKey, now = new Date()) => lagosMidnight(day) > now;

export function addDays(day: DayKey, n: number): DayKey {
  const { y, m, d } = parse(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return key(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** First Lagos day on which a capsule can still be scheduled: tomorrow. */
export const firstSchedulableDay = (now = new Date()): DayKey => addDays(lagosDay(now), 1);

/** "YYYY-MM" of a day. */
export const monthOf = (day: DayKey) => day.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, 1)));
}

export interface GridCell {
  day: DayKey;
  inMonth: boolean;
}

/** Monday-first weeks covering the month; leading and trailing days are outside it. */
export function monthGrid(month: string): GridCell[] {
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y!, m! - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const total = Math.ceil((lead + length) / 7) * 7;
  const start = key(y!, m!, 1);
  return Array.from({ length: total }, (_, i) => {
    const day = addDays(start, i - lead);
    return { day, inMonth: monthOf(day) === month };
  });
}
