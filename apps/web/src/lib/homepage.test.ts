import { describe, expect, it } from "vitest";
import { visibleSections, sectionsFromApi, sectionsFromQuery } from "./homepage";

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
