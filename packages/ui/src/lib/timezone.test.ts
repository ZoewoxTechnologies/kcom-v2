import { describe, expect, it } from "vitest";
import {
  formatInZone,
  fromZoneParts,
  nextZoneMidnight,
  toZoneParts,
  zoneDateKey,
  zoneLabel,
} from "./timezone";

const LAGOS = "Africa/Lagos";

describe("Lagos (UTC+1, no DST)", () => {
  it("converts UTC to zone parts across the day boundary", () => {
    expect(toZoneParts(new Date("2026-03-01T23:30:00Z"), LAGOS)).toEqual({
      year: 2026,
      month: 3,
      day: 2,
      hour: 0,
      minute: 30,
    });
    expect(zoneDateKey(new Date("2026-03-01T22:59:00Z"), LAGOS)).toBe("2026-03-01");
    expect(zoneDateKey(new Date("2026-03-01T23:00:00Z"), LAGOS)).toBe("2026-03-02");
  });

  it("round-trips parts", () => {
    const parts = { year: 2026, month: 12, day: 31, hour: 23, minute: 59 };
    expect(toZoneParts(fromZoneParts(parts, LAGOS), LAGOS)).toEqual(parts);
  });

  it("next midnight is the following zone midnight", () => {
    const next = (iso: string) => nextZoneMidnight(new Date(iso), LAGOS).toISOString();
    expect(next("2026-03-01T12:00:00Z")).toBe("2026-03-01T23:00:00.000Z");
    expect(next("2026-03-01T22:59:59Z")).toBe("2026-03-01T23:00:00.000Z");
    expect(next("2026-03-01T23:00:00Z")).toBe("2026-03-02T23:00:00.000Z");
    expect(next("2026-12-31T23:30:00Z")).toBe("2027-01-01T23:00:00.000Z");
  });

  it("formats with the zone abbreviation", () => {
    const text = formatInZone(new Date("2026-03-01T23:00:00Z"), LAGOS);
    expect(text).toContain("2 Mar 2026");
    expect(text).toContain("00:00");
    expect(text).toContain("GMT+1");
  });
});

describe("other zones", () => {
  it("handles daylight saving", () => {
    const ny = "America/New_York";
    expect(
      fromZoneParts({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 }, ny).toISOString(),
    ).toBe("2026-01-15T17:00:00.000Z");
    expect(
      fromZoneParts({ year: 2026, month: 7, day: 15, hour: 12, minute: 0 }, ny).toISOString(),
    ).toBe("2026-07-15T16:00:00.000Z");
    expect(nextZoneMidnight(new Date("2026-03-07T12:00:00Z"), ny).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
  });

  it("labels zones by city", () => {
    expect(zoneLabel("Africa/Lagos")).toBe("Lagos");
    expect(zoneLabel("America/New_York")).toBe("New York");
    expect(zoneLabel("UTC")).toBe("UTC");
  });
});
