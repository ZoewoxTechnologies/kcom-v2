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
