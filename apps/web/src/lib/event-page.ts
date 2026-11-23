const TZ = "Africa/Lagos";
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  // en-GB puts a comma after the weekday; the design has none.
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts })
    .format(new Date(iso))
    .replace(/^(\w+), /, "$1 ");

/** "Friday 12 – Sunday 14 March 2027", or with times for a single timed day. */
export function eventWhen(e: { startsAt: string; endsAt: string | null; allDay: boolean }): string {
  const day = { weekday: "long", day: "numeric", month: "long", year: "numeric" } as const;
  const time = { hour: "numeric", minute: "2-digit", hour12: true } as const;
  const first = fmt(e.startsAt, day);
  const last = e.endsAt ? fmt(e.endsAt, day) : first;
  if (first !== last) return `${first} – ${last}`;
  if (e.allDay) return first;
  const start = fmt(e.startsAt, time);
  return e.endsAt ? `${first}, ${start} – ${fmt(e.endsAt, time)}` : `${first}, ${start}`;
}

/** Short form for lists: "Sunday · 10:00 a.m." (weekday only for all-day events). */
export function eventDayTime(e: { startsAt: string; allDay: boolean }): string {
  const day = fmt(e.startsAt, { weekday: "long" });
  if (e.allDay) return day;
  return `${day} · ${fmt(e.startsAt, { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?([ap])m$/i, " $1.m.")}`;
}

/** Programme text as rows: "Fri · 6 p.m. · Opening" becomes a time and an item. */
export function programmeRows(text: string | null): { time: string; item: string }[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.lastIndexOf(" · ");
      return i === -1
        ? { time: "", item: line }
        : { time: line.slice(0, i), item: line.slice(i + 3) };
    });
}

/** Month, day and year of the start, in Lagos time, for the date badge. */
export function eventBadge(startsAt: string): { month: string; day: string; year: string } {
  const p = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(new Date(startsAt));
  return {
    month: p({ month: "short" }).toUpperCase(),
    day: p({ day: "numeric" }),
    year: p({ year: "numeric" }),
  };
}

const icsStamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");
const icsDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso)).replace(/-/g, "");
const icsText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/[;,]/g, "\\$&").replace(/\n/g, "\\n");

/** A `data:` link to an .ics calendar file for the event. */
export function calendarHref(e: {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  place: string | null;
}): string {
  const when = e.allDay
    ? [
        `DTSTART;VALUE=DATE:${icsDay(e.startsAt)}`,
        `DTEND;VALUE=DATE:${icsDay(new Date(new Date(e.endsAt ?? e.startsAt).getTime() + 864e5).toISOString())}`,
      ]
    : [`DTSTART:${icsStamp(e.startsAt)}`, `DTEND:${icsStamp(e.endsAt ?? e.startsAt)}`];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kingdom Capstone Outreach Ministries//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.slug}@kingdomcapstone`,
    `DTSTAMP:${icsStamp(e.startsAt)}`,
    ...when,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.place ? [`LOCATION:${icsText(e.place)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export const directionsHref = (place: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

/** Card date block: month, day and weekday ("Saturday", or "Fri – Sun" across days). */
export function eventListBadge(e: { startsAt: string; endsAt: string | null }): {
  month: string;
  day: string;
  weekday: string;
} {
  const { month, day } = eventBadge(e.startsAt);
  const dow = (iso: string, weekday: "long" | "short") => fmt(iso, { weekday });
  const span =
    e.endsAt && fmt(e.endsAt, { dateStyle: "short" }) !== fmt(e.startsAt, { dateStyle: "short" });
  return {
    month,
    day: day.padStart(2, "0"),
    weekday: span
      ? `${dow(e.startsAt, "short")} – ${dow(e.endsAt!, "short")}`
      : dow(e.startsAt, "long"),
  };
}

/** "10:00 a.m." for one day, "12–14 March" across days, "All day" otherwise. */
export function eventListWhen(e: {
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
}): string {
  const d = (iso: string, o: Intl.DateTimeFormatOptions) => fmt(iso, o);
  if (e.endsAt && d(e.endsAt, { dateStyle: "short" }) !== d(e.startsAt, { dateStyle: "short" })) {
    const [a, b] = [e.startsAt, e.endsAt];
    const sameMonth =
      d(a, { month: "long", year: "numeric" }) === d(b, { month: "long", year: "numeric" });
    return sameMonth
      ? `${d(a, { day: "numeric" })}–${d(b, { day: "numeric", month: "long" })}`
      : `${d(a, { day: "numeric", month: "long" })} – ${d(b, { day: "numeric", month: "long" })}`;
  }
  return e.allDay
    ? "All day"
    : d(e.startsAt, { hour: "numeric", minute: "2-digit", hour12: true }).replace(
        /\s?([ap])m$/i,
        " $1.m.",
      );
}

/** "10:00 a.m. · Venue", "Online and in person" when both, as the design does. */
export function eventListWhere(e: { place: string | null; online: boolean }): string | null {
  if (e.place && e.online) return `${e.place} and online`;
  return e.place ?? (e.online ? "Online" : null);
}

/** "Nov 2025" for the past-events list. */
export const eventMonthYear = (startsAt: string) =>
  fmt(startsAt, { month: "short", year: "numeric" });
