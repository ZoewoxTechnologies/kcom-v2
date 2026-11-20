import { describe, expect, it } from "vitest";
import {
  addDays,
  canScheduleOn,
  firstSchedulableDay,
  lagosDay,
  lagosMidnight,
  monthGrid,
  fullDayLabel,
  shiftMonth,
  shortDayLabel,
} from "./days";

describe("Lagos day boundaries", () => {
  it("puts 23:00 UTC on the next Lagos day", () => {
    // Lagos is UTC+1, so 23:00Z on the 19th is 00:00 on the 20th.
    expect(lagosDay("2026-11-19T22:59:59Z")).toBe("2026-11-19");
    expect(lagosDay("2026-11-19T23:00:00Z")).toBe("2026-11-20");
  });

  it("keeps the last Lagos minute in its own day", () => {
    expect(lagosDay("2026-11-20T22:59:00Z")).toBe("2026-11-20");
  });

  it("crosses month and year ends in Lagos time", () => {
    expect(lagosDay("2026-11-30T23:00:00Z")).toBe("2026-12-01");
    expect(lagosDay("2026-12-31T23:30:00Z")).toBe("2027-01-01");
  });

  it("maps a Lagos day to its midnight instant", () => {
    expect(lagosMidnight("2026-11-20").toISOString()).toBe("2026-11-19T23:00:00.000Z");
    expect(lagosMidnight("2027-01-01").toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("round-trips a midnight back to the same Lagos day", () => {
    for (const day of ["2026-02-28", "2026-03-01", "2026-12-31"]) {
      expect(lagosDay(lagosMidnight(day))).toBe(day);
    }
  });

  it("allows only days whose midnight is still ahead", () => {
    const now = new Date("2026-11-19T23:30:00Z"); // 00:30 on 20 Nov in Lagos
    expect(canScheduleOn("2026-11-20", now)).toBe(false);
    expect(canScheduleOn("2026-11-21", now)).toBe(true);
    expect(firstSchedulableDay(now)).toBe("2026-11-21");
    const before = new Date("2026-11-19T22:30:00Z"); // 23:30 on 19 Nov in Lagos
    expect(canScheduleOn("2026-11-20", before)).toBe(true);
  });
});

describe("month grid", () => {
  it("starts on Monday and fills whole weeks", () => {
    const grid = monthGrid("2026-11");
    // 1 Nov 2026 is a Sunday, so the first row starts on Monday 26 Oct.
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ day: "2026-10-26", inMonth: false });
    expect(grid[6]).toEqual({ day: "2026-11-01", inMonth: true });
  });

  it("pads leading days from the previous month", () => {
    const grid = monthGrid("2026-12"); // 1 Dec 2026 is a Tuesday
    expect(grid[0]).toEqual({ day: "2026-11-30", inMonth: false });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("day labels", () => {
  it("formats short and full labels", () => {
    expect(shortDayLabel("2026-11-24")).toBe("Tue 24 Nov");
    expect(fullDayLabel("2026-11-24")).toBe("Tuesday 24 November");
  });
});
