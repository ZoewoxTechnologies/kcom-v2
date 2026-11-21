import { describe, expect, it } from "vitest";
import { aboutLinks, getAbout } from "./about";

describe("about", () => {
  it("returns team and arms", async () => {
    const a = await getAbout();
    expect(a.team.length).toBeGreaterThan(0);
    expect(a.arms.every((x) => x.abbr && x.name && x.text)).toBe(true);
  });
  it("links both pages", () => {
    expect(aboutLinks.map((l) => l.href)).toEqual(["/about", "/about/team"]);
  });
});
