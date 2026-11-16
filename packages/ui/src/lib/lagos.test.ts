import { describe, expect, it } from "vitest";
import {
  formatLagos,
  fromLagosParts,
  lagosDateKey,
  nextLagosMidnight,
  toLagosParts,
} from "./lagos";

describe("Lagos time", () => {
  it("converts UTC to Lagos parts across the day boundary", () => {
    // 23:30 UTC on 1 Mar is 00:30 on 2 Mar in Lagos.
    expect(toLagosParts(new Date("2026-03-01T23:30:00Z"))).toEqual({
      year: 2026,
      month: 3,
      day: 2,
      hour: 0,
      minute: 30,
    });
    expect(lagosDateKey(new Date("2026-03-01T22:59:00Z"))).toBe("2026-03-01");
    expect(lagosDateKey(new Date("2026-03-01T23:00:00Z"))).toBe("2026-03-02");
  });

  it("round-trips Lagos parts", () => {
    const parts = { year: 2026, month: 12, day: 31, hour: 23, minute: 59 };
    expect(toLagosParts(fromLagosParts(parts))).toEqual(parts);
  });

  it("next midnight is the following Lagos midnight", () => {
    expect(nextLagosMidnight(new Date("2026-03-01T12:00:00Z")).toISOString()).toBe(
      "2026-03-01T23:00:00.000Z",
    );
    // Just before Lagos midnight.
    expect(nextLagosMidnight(new Date("2026-03-01T22:59:59Z")).toISOString()).toBe(
      "2026-03-01T23:00:00.000Z",
    );
    // Exactly at Lagos midnight moves a full day on.
    expect(nextLagosMidnight(new Date("2026-03-01T23:00:00Z")).toISOString()).toBe(
      "2026-03-02T23:00:00.000Z",
    );
    // Year end.
    expect(nextLagosMidnight(new Date("2026-12-31T23:30:00Z")).toISOString()).toBe(
      "2027-01-01T23:00:00.000Z",
    );
  });

  it("formats in Lagos time", () => {
    expect(formatLagos(new Date("2026-03-01T23:00:00Z"))).toContain("00:00 WAT");
    expect(formatLagos(new Date("2026-03-01T23:00:00Z"))).toContain("2 Mar 2026");
  });
});
