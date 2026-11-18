import { describe, expect, it } from "vitest";
import { isCurrent, navItems } from "./nav";

const by = (label: string) => navItems.find((i) => i.label === label)!;

describe("nav", () => {
  it("has the ticket's links and no Gallery", () => {
    expect(navItems.map((i) => i.label)).toEqual([
      "Home", "About", "Capstone Capsules", "Blog", "Events", "Books", "Partner With Us", "Contact",
    ]);
  });
  it("matches current page, including children and trailing slashes", () => {
    expect(isCurrent(by("Home"), "/")).toBe(true);
    expect(isCurrent(by("Home"), "/blog")).toBe(false);
    expect(isCurrent(by("Capstone Capsules"), "/capsules/today")).toBe(true);
    expect(isCurrent(by("Capstone Capsules"), "/series")).toBe(true);
    expect(isCurrent(by("Blog"), "/blog/")).toBe(true);
    expect(isCurrent(by("Blog"), "/books")).toBe(false);
  });
});
