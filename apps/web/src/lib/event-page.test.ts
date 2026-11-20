import { describe, expect, it } from "vitest";
import { eventWhen, programmeRows } from "./event-page";

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
