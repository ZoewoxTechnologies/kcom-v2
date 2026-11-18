import { describe, expect, it } from "vitest";
import { dayParts, formatLagosDate, formatLagosShortDate, lagosDate, lagosDayRange, lagosMonth, lagosMonthRange, monthLabel, nextLagosMidnight, shiftMonth, shortMonthYear, slugify } from "./publish";

const next = (iso: string) => nextLagosMidnight(new Date(iso)).toISOString();

describe("nextLagosMidnight", () => {
  it("evening in Lagos goes live at that night's midnight", () => {
    expect(next("2026-11-16T21:00:00Z")).toBe("2026-11-16T23:00:00.000Z"); // 22:00 WAT
  });

  it("morning in Lagos goes live at the next midnight", () => {
    expect(next("2026-11-16T08:00:00Z")).toBe("2026-11-16T23:00:00.000Z");
  });

  it("just after Lagos midnight rolls to the following day", () => {
    expect(next("2026-11-16T23:00:00Z")).toBe("2026-11-17T23:00:00.000Z"); // exactly 00:00 WAT
    expect(next("2026-11-16T23:30:00Z")).toBe("2026-11-17T23:00:00.000Z");
  });

  it("is strictly after now, one millisecond before midnight included", () => {
    expect(next("2026-11-16T22:59:59.999Z")).toBe("2026-11-16T23:00:00.000Z");
  });

  it("handles year and month boundaries", () => {
    expect(next("2026-12-31T23:30:00Z")).toBe("2027-01-01T23:00:00.000Z");
    expect(next("2028-02-28T12:00:00Z")).toBe("2028-02-28T23:00:00.000Z");
  });
});

describe("lagosDate", () => {
  it("23:00 UTC is already the next day in Lagos", () => {
    expect(lagosDate(new Date("2026-11-16T23:00:00Z"))).toBe("2026-11-17");
    expect(lagosDate(new Date("2026-11-16T22:59:59Z"))).toBe("2026-11-16");
  });
});

describe("slugify", () => {
  it("normalises legacy-style titles and path segments", () => {
    expect(slugify("Peace_Be Still!")).toBe("peace-be-still");
    expect(slugify("content/2019/03/Café—Hope")).toBe("content-2019-03-cafe-hope");
    expect(slugify("A Sound Mind -3")).toBe("a-sound-mind-3");
  });
  it("returns empty when nothing usable remains", () => {
    expect(slugify("日本語")).toBe("");
  });
});

describe("formatLagosDate", () => {
  it("formats a Lagos calendar day with weekday", () => {
    expect(formatLagosDate("2026-11-14")).toBe("Saturday, 14 November");
    expect(formatLagosDate("2026-01-01")).toBe("Thursday, 1 January");
  });
});

describe("formatLagosShortDate", () => {
  it("formats day and short month", () => {
    expect(formatLagosShortDate("2026-11-14")).toBe("14 Nov");
    expect(formatLagosShortDate("2026-01-01")).toBe("1 Jan");
  });
});

describe("lagosDayRange", () => {
  it("spans 23:00 UTC to 23:00 UTC", () => {
    const [from, to] = lagosDayRange("2026-01-10");
    expect([from.toISOString(), to.toISOString()]).toEqual([
      "2026-01-09T23:00:00.000Z",
      "2026-01-10T23:00:00.000Z",
    ]);
  });
});

describe("lagosMonthRange", () => {
  it("covers the month", () => {
    const [from, to] = lagosMonthRange("2026-02");
    expect([from.toISOString(), to.toISOString()]).toEqual([
      "2026-01-31T23:00:00.000Z",
      "2026-02-28T23:00:00.000Z",
    ]);
  });
  it("rolls over the year", () => {
    expect(lagosMonthRange("2026-12")[1].toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
});

describe("month and day labels", () => {
  it("uses the Lagos month, not the UTC one", () => {
    expect(lagosMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
  it("labels and shifts months across years", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(shortMonthYear("2026-11-14")).toBe("Nov 2026");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });
});

describe("dayParts", () => {
  it("splits a Lagos day into weekday and day of the month", () => {
    expect(dayParts("2026-11-14")).toEqual({ dow: "SAT", n: 14 });
    expect(dayParts("2026-11-01")).toEqual({ dow: "SUN", n: 1 });
    expect(dayParts("2028-02-29")).toEqual({ dow: "TUE", n: 29 });
  });
});

describe("shiftMonth", () => {
  it("steps one month either way, across year ends", () => {
    expect(shiftMonth("2026-05", 1)).toBe("2026-06");
    expect(shiftMonth("2026-05", -1)).toBe("2026-04");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
