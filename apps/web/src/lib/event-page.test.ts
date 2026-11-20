import { describe, expect, it } from "vitest";
import { calendarHref, directionsHref, eventBadge, eventListBadge, eventListWhen, eventListWhere, eventMonthYear, eventWhen, programmeRows } from "./event-page";

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

describe("event list helpers", () => {
  it("badge: padded day and weekday, short span across days", () => {
    expect(eventListBadge({ startsAt: "2027-01-01T08:00:00Z", endsAt: null })).toEqual({ month: "JAN", day: "01", weekday: "Friday" });
    expect(eventListBadge({ startsAt: "2027-03-12T17:00:00Z", endsAt: "2027-03-14T13:00:00Z" }).weekday).toBe("Fri – Sun");
  });
  it("when: time, day range or all day", () => {
    expect(eventListWhen({ startsAt: "2026-12-06T09:00:00Z", endsAt: null, allDay: false })).toBe("10:00 a.m.");
    expect(eventListWhen({ startsAt: "2027-03-12T17:00:00Z", endsAt: "2027-03-14T13:00:00Z", allDay: false })).toBe("12–14 March");
    expect(eventListWhen({ startsAt: "2027-03-12T10:00:00Z", endsAt: null, allDay: true })).toBe("All day");
  });
  it("where and month/year", () => {
    expect(eventListWhere({ place: "Hall", online: true })).toBe("Hall and online");
    expect(eventListWhere({ place: null, online: true })).toBe("Online");
    expect(eventListWhere({ place: null, online: false })).toBeNull();
    expect(eventMonthYear("2025-11-14T17:00:00Z")).toBe("Nov 2025");
  });
});
