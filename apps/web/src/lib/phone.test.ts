import { describe, expect, it } from "vitest";
import { formatPhone, phoneHref } from "./phone";

describe("formatPhone", () => {
  it("shows international format with spaces", () => {
    expect(formatPhone("+2348058009879")).toBe("+234 805 800 9879");
    expect(formatPhone("+234 (805) 800-9879")).toBe("+234 805 800 9879");
  });
  it("shows unparseable input as entered", () => {
    expect(formatPhone("call the office")).toBe("call the office");
    expect(formatPhone("0805 800 9879")).toBe("0805 800 9879");
  });
  it("trims and handles empty", () => {
    expect(formatPhone("  +2348058009879 ")).toBe("+234 805 800 9879");
    expect(formatPhone("")).toBe("");
  });
});

describe("phoneHref", () => {
  it("keeps digits and a leading plus", () => {
    expect(phoneHref("+234 (805) 800-9879")).toBe("tel:+2348058009879");
  });
});
