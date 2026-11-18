import { describe, expect, it } from "vitest";
import { dayParts, formatLagosShortDate } from "@kcom/content";
import { loadCapsulePage, onThisDay, shiftMonth } from "./capsule-page";
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

describe("page data", () => {
  it("finds the series and past years", async () => {
    const c = sampleCapsules[0]!;
    const p = await loadCapsulePage(sampleSource, c);
    expect(p.seriesInfo?.series.title).toBe("The Renewed Mind");
    expect(p.seriesInfo?.members.map((m) => m.partNumber)).toEqual([7, 8, 9, 10, 11]);
    expect((await onThisDay(sampleSource, "2026-11-14")).map((x) => x.displayDate)).toEqual(["2025-11-14", "2024-11-14"]);
  });
  it("takes previous and next from the API, which skips unpublished days", async () => {
    // sample data has no capsule on 11 Nov
    const p = await loadCapsulePage(sampleSource, sampleCapsules.find((c) => c.slug === "thoughts-taken-captive")!);
    expect(p.prev?.displayDate).toBe("2026-11-10");
    expect(p.next?.displayDate).toBe("2026-11-13");
    expect((await loadCapsulePage(sampleSource, sampleCapsules[0]!)).next).toBeNull();
  });
  it("has no series info for a standalone capsule", async () => {
    const p = await loadCapsulePage(sampleSource, sampleCapsules.find((c) => !c.seriesId)!);
    expect(p.seriesInfo).toBeNull();
  });
});
