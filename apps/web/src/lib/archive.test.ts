import { describe, expect, it } from "vitest";
import { createSampleSource } from "./data/sample";
import { toSeriesSummary } from "./data/series";
import { shiftMonth } from "@kcom/content";
import { archiveStartYear } from "./archive-start";
import {
  archiveIntro,
  archiveYears,
  monthForYear,
  parseMonth,
  parseSort,
  sortSeries,
} from "./archive";

describe("months", () => {
  it("rejects bad, future and pre-archive months", () => {
    expect(parseMonth("2026-11", "2026-11", 2015)?.month).toBe(11);
    expect(parseMonth("2015-01", "2026-11", 2015)?.month).toBe(1);
    for (const bad of ["2026-12", "2026-13", "2026-1", "x", undefined, "2014-12"])
      expect(parseMonth(bad, "2026-11", 2015)).toBeNull();
  });
  it("lists years newest first", () => {
    expect(archiveYears("2014-05", 2012)).toEqual([2014, 2013, 2012]);
    expect(archiveYears("2026-11", 2015)).toHaveLength(12);
    expect(archiveYears("2026-11", 2026)).toEqual([2026]);
  });
  it("lands on December, or the current month in the current year", () => {
    expect(monthForYear(2025, "2026-11", 2015)).toBe("2025-12");
    expect(monthForYear(2026, "2026-11", 2015)).toBe("2026-11");
    expect(monthForYear(2027, "2026-11", 2015)).toBeNull();
    expect(monthForYear(2014, "2026-11", 2015)).toBeNull();
  });
});

describe("series", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  const s = (title: string, days: string[]) =>
    toSeriesSummary(
      {
        slug: title,
        title,
        description: null,
        capsuleCount: days.length,
        firstDate: days[0]!,
        lastDate: days[days.length - 1]!,
        latestPart: days.length,
      },
      now,
    );
  it("counts and flags a running series (latest part today or yesterday)", () => {
    expect(s("a", ["2026-11-13", "2026-11-14"])).toMatchObject({
      count: 2,
      inProgress: true,
      latestPart: 2,
      firstDate: "2026-11-13",
    });
    expect(s("b", ["2026-11-01", "2026-11-12"]).inProgress).toBe(false);
  });
  it("sorts", () => {
    const list = [
      s("B", ["2026-01-01"]),
      s("A", ["2026-02-01", "2026-02-02"]),
      s("C", ["2026-03-01"]),
    ];
    expect(sortSeries(list, "newest").map((x) => x.title)).toEqual(["C", "A", "B"]);
    expect(sortSeries(list, "az").map((x) => x.title)).toEqual(["A", "B", "C"]);
    expect(sortSeries(list, "longest")[0]!.title).toBe("A");
    expect(parseSort("nope")).toBe("newest");
  });
  it("sample archive: every series capsule is reachable by month and by series, counts agree", async () => {
    const src = createSampleSource(() => now);
    const series = await src.listSeries();
    let total = 0;
    for (const sr of series) {
      const d = await src.seriesBySlug(sr.slug);
      expect(d!.capsules).toHaveLength(sr.count);
      total += sr.count;
    }
    let byMonth = 0;
    for (let m = "2026-11"; m >= "2025-01"; m = shiftMonth(m, -1))
      byMonth += (await src.listCapsulesInMonth(m)).length;
    expect(byMonth).toBe(total);
  });
});

describe("archive start", () => {
  it("is the year of the earliest capsule, else the current Lagos year", () => {
    expect(archiveStartYear("2015-01-01")).toBe(2015);
    expect(archiveStartYear(null, new Date("2026-11-22T10:00:00Z"))).toBe(2026);
    expect(archiveIntro(2015)).toBe("Every daily capsule since 2015, to read and share.");
  });
});
