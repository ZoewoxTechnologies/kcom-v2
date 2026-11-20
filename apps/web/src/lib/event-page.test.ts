import { describe, expect, it } from "vitest";
import { calendarHref, directionsHref, eventBadge, eventWhen, programmeRows } from "./event-page";

describe("eventWhen", () => {
  it("spans days, hides times for all day, shows times otherwise", () => {
    expect(
      eventWhen({
        startsAt: "2027-03-12T17:00:00Z",
        endsAt: "2027-03-14T13:00:00Z",
        allDay: false,
      }),
    ).toBe("Friday 12 March 2027 – Sunday 14 March 2027");
    expect(eventWhen({ startsAt: "2027-03-12T09:00:00Z", endsAt: null, allDay: true })).toBe(
      "Friday 12 March 2027",
    );
    expect(eventWhen({ startsAt: "2027-03-12T17:00:00Z", endsAt: null, allDay: false })).toBe(
      "Friday 12 March 2027, 6:00 pm",
    );
  });
});

describe("programmeRows", () => {
  it("splits time from item and ignores blank lines", () => {
    expect(programmeRows("Fri · 6 p.m. · Opening\n\nClosing")).toEqual([
      { time: "Fri · 6 p.m.", item: "Opening" },
      { time: "", item: "Closing" },
    ]);
    expect(programmeRows(null)).toEqual([]);
  });
});

describe("badge, calendar and directions", () => {
  it("builds the badge in Lagos time", () => {
    expect(eventBadge("2027-03-12T17:00:00Z")).toEqual({ month: "MAR", day: "12", year: "2027" });
  });
  it("builds an ics link and a maps link", () => {
    const e = {
      slug: "c",
      title: "A, B",
      startsAt: "2027-03-12T17:00:00.000Z",
      endsAt: null,
      allDay: false,
      place: "Hall",
    };
    const ics = decodeURIComponent(calendarHref(e).split(",").slice(1).join(","));
    expect(ics).toContain("DTSTART:20270312T170000Z");
    expect(ics).toContain("SUMMARY:A\\, B");
    expect(decodeURIComponent(calendarHref({ ...e, allDay: true }))).toContain(
      "DTSTART;VALUE=DATE:20270312",
    );
    expect(directionsHref("A B")).toContain("query=A%20B");
  });
});
