import { describe, expect, it } from "vitest";
import { pageTitle } from "./site";

describe("pageTitle", () => {
  it("appends the site name", () => {
    expect(pageTitle("Capsules")).toBe("Capsules | Kingdom Capstone");
    expect(pageTitle()).toBe("Kingdom Capstone");
  });
});
