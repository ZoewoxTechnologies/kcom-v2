/** Time-zone helpers built on Intl, so any IANA zone works (daylight saving included). */
export const DEFAULT_TIME_ZONE = "Africa/Lagos";

export interface ZoneParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function toZoneParts(date: Date, timeZone: string): ZoneParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour!,
    minute: out.minute!,
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = toZoneParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

/** The instant at which the zone's wall clock reads `parts`. Day and month may overflow. */
export function fromZoneParts(parts: ZoneParts, timeZone: string): Date {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** "YYYY-MM-DD" of the zone's calendar day containing the instant. */
export function zoneDateKey(date: Date, timeZone: string): string {
  const p = toZoneParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The next 00:00 in the zone strictly after `now`. */
export function nextZoneMidnight(now: Date, timeZone: string): Date {
  const p = toZoneParts(now, timeZone);
  return fromZoneParts({ ...p, day: p.day + 1, hour: 0, minute: 0 }, timeZone);
}

/** "Fri, 20 Nov 2026, 06:00", in the given zone. The zone is named by the surrounding label, not repeated here. */
export function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Zones whose everyday abbreviation reads better than the city name. */
const ZONE_ABBREVIATIONS: Record<string, string> = { "Africa/Lagos": "WAT" };

/** Readable zone name for labels: "Africa/Lagos" becomes "WAT"; other zones use their city. */
export function zoneLabel(timeZone: string): string {
  return ZONE_ABBREVIATIONS[timeZone] ?? (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}
