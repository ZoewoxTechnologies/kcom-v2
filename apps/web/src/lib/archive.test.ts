import { describe, expect, it } from "vitest";
import { createSampleSource } from "./data/sample";
import { summarizeSeries } from "./data/series";
import { archiveYears, dayParts, lagosMonth, monthForYear, pageWindow, paginate, parseMonth, parseSort, shiftMonth, sortSeries } from "./archive";

describe("months", () => {
  it("uses the Lagos month, not the UTC one", () => {
    expect(lagosMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
  it("rejects bad, future and pre-archive months", () => {
    expect(parseMonth("2026-11", "2026-11")?.month).toBe(11);
    for (const bad of ["2026-12", "2026-13", "2026-1", "x", undefined, "2011-12"]) expect(parseMonth(bad, "2026-11")).toBeNull();
  });
  it("shifts across years and lists years newest first", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(archiveYears("2014-05")).toEqual([2014, 2013, 2012]);
  });
  it("lands on December, or the current month in the current year", () => {
    expect(monthForYear(2025, "2026-11")).toBe("2025-12");
    expect(monthForYear(2026, "2026-11")).toBe("2026-11");
    expect(monthForYear(2027, "2026-11")).toBeNull();
  });
  it("splits a Lagos day", () => expect(dayParts("2026-11-14")).toEqual({ dow: "SAT", n: 14 }));
});

describe("pagination", () => {
  it("clamps and survives garbage", () => {
    expect(paginate([1, 2, 3, 4, 5], "2", 2)).toEqual({ page: 2, pages: 3, items: [3, 4] });
    expect(paginate([1, 2, 3], "99", 2).page).toBe(2);
    expect(paginate([1, 2, 3], "abc", 2).page).toBe(1);
    expect(paginate([], "1", 9)).toEqual({ page: 1, pages: 1, items: [] });
  });
  it("windows with gaps", () => {
    expect(pageWindow(1, 21)).toEqual([1, 2, null, 21]);
    expect(pageWindow(10, 21)).toEqual([1, null, 9, 10, 11, null, 21]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
});

describe("series", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  const s = (title: string, days: string[]) =>
    summarizeSeries({ slug: title, title, description: null }, days.map((d, i) => ({ displayDate: d, partNumber: i + 1 })), now)!;
  it("counts and flags a running series (latest part today or yesterday)", () => {
    expect(s("a", ["2026-11-13", "2026-11-14"])).toMatchObject({ count: 2, inProgress: true, latestPart: 2, firstDate: "2026-11-13" });
    expect(s("b", ["2026-11-01", "2026-11-12"]).inProgress).toBe(false);
    expect(summarizeSeries({ slug: "x", title: "x", description: null }, [], now)).toBeNull();
  });
  it("sorts", () => {
    const list = [s("B", ["2026-01-01"]), s("A", ["2026-02-01", "2026-02-02"]), s("C", ["2026-03-01"])];
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
    for (let m = "2026-11"; m >= "2025-01"; m = shiftMonth(m, -1)) byMonth += (await src.capsulesInMonth(m)).length;
    expect(byMonth).toBe(total);
  });
});
