import { describe, expect, it } from "vitest";
import { dayParts, formatLagosShortDate } from "@kcom/content";
import { loadCapsulePage, neighbours, onThisDay, shiftMonth } from "./capsule-page";
import { sampleCapsules, sampleSource } from "./data/sample";

describe("dates", () => {
  it("formats day parts", () => {
    expect(dayParts("2026-11-14")).toEqual({ weekday: "Saturday", weekdayShort: "Sat", rest: "14 November 2026" });
    expect(formatLagosShortDate("2026-11-14")).toBe("14 Nov");
  });
  it("shifts months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("neighbours", () => {
  it("skips days without a capsule", async () => {
    // sample data has no capsule on 11 Nov
    const n = await neighbours(sampleSource, "2026-11-12", "2026-11-14");
    expect(n.prev?.displayDate).toBe("2026-11-10");
    expect(n.next?.displayDate).toBe("2026-11-13");
  });
  it("looks across month boundaries, up to two years", async () => {
    const n = await neighbours(sampleSource, "2026-11-09", "2026-11-14");
    expect(n.prev?.displayDate).toBe("2025-11-14");
    expect((await neighbours(sampleSource, "2024-11-14", "2026-11-14")).prev).toBeNull();
  });
  it("has no next on the latest day, and ignores days after today", async () => {
    expect((await neighbours(sampleSource, "2026-11-14", "2026-11-14")).next).toBeNull();
    expect((await neighbours(sampleSource, "2026-11-12", "2026-11-12")).next).toBeNull();
  });
});

describe("page data", () => {
  it("finds the series and past years", async () => {
    const c = sampleCapsules[0]!;
    const p = await loadCapsulePage(sampleSource, c, new Date("2026-11-14T10:00:00Z"));
    expect(p.seriesInfo?.series.title).toBe("The Renewed Mind");
    expect(p.seriesInfo?.members.map((m) => m.partNumber)).toEqual([7, 8, 9, 10, 11]);
    expect((await onThisDay(sampleSource, "2026-11-14")).map((x) => x.displayDate)).toEqual(["2025-11-14", "2024-11-14"]);
  });
  it("has no series info for a standalone capsule", async () => {
    const p = await loadCapsulePage(sampleSource, sampleCapsules.find((c) => !c.seriesId)!, new Date("2026-11-14T10:00:00Z"));
    expect(p.seriesInfo).toBeNull();
  });
});
