import { describe, expect, it } from "vitest";
import { visibleSections, sectionsFromQuery } from "./homepage";

describe("visibleSections", () => {
  it("defaults to all sections with today first", () => {
    expect(visibleSections()).toEqual(["today", "current-series", "past-series", "blog", "events-books", "signup"]);
  });
  it("honours order and hidden flags, keeps today first and shown", () => {
    expect(visibleSections([{ key: "blog" }, { key: "today", hidden: true }, { key: "signup", hidden: true }, { key: "nope" }, { key: "blog" }]))
      .toEqual(["today", "blog", "current-series", "past-series", "events-books"]);
  });
  it("parses the preview query", () => {
    expect(visibleSections(sectionsFromQuery("blog,-signup")!)).toEqual(["today", "blog", "current-series", "past-series", "events-books"]);
    expect(sectionsFromQuery(null)).toBeNull();
  });
});
