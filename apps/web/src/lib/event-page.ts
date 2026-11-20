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
