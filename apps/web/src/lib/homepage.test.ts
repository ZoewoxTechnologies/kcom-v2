import { describe, expect, it } from "vitest";
import { recentSeriesRows, visibleSections, sectionsFromApi, sectionsFromQuery } from "./homepage";

describe("visibleSections", () => {
  it("defaults to all sections with today first", () => {
    expect(visibleSections()).toEqual([
      "today",
      "current-series",
      "past-series",
      "blog",
      "events-books",
      "signup",
    ]);
  });
  it("honours order and hidden flags, keeps today first and shown", () => {
    expect(
      visibleSections([
        { key: "blog" },
        { key: "today", hidden: true },
        { key: "signup", hidden: true },
        { key: "nope" },
        { key: "blog" },
      ]),
    ).toEqual(["today", "blog", "current-series", "past-series", "events-books"]);
  });
  it("parses the preview query", () => {
    expect(visibleSections(sectionsFromQuery("blog,-signup")!)).toEqual([
      "today",
      "blog",
      "current-series",
      "past-series",
      "events-books",
    ]);
    expect(sectionsFromQuery(null)).toBeNull();
  });
});

describe("sectionsFromApi", () => {
  it("shows the listed sections in order and hides the rest", () => {
    const sections = sectionsFromApi(["todays_capsule", "blog", "current_series", "email_signup"])!;
    expect(visibleSections(sections)).toEqual(["today", "blog", "current-series", "signup"]);
  });
  it("is null when the API gave nothing usable", () => {
    expect(sectionsFromApi([])).toBeNull();
    expect(sectionsFromApi(["nope"])).toBeNull();
  });
});

describe("recentSeriesRows", () => {
  const days = [
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ].map((displayDate) => ({ displayDate }));
  it("lists the latest days newest first with today at the top", () => {
    expect(recentSeriesRows(days, "2026-11-20").map((c) => c.displayDate)).toEqual([
      "2026-11-20",
      "2026-11-19",
      "2026-11-18",
      "2026-11-17",
    ]);
  });
  it("leaves out days still to come and caps the count", () => {
    expect(recentSeriesRows(days, "2026-11-22", 2).map((c) => c.displayDate)).toEqual([
      "2026-11-22",
      "2026-11-21",
    ]);
    expect(recentSeriesRows(days, "2026-11-10")).toEqual([]);
  });
});
