import { describe, expect, it } from "vitest";
import { shouldTrack } from "./analytics";

describe("shouldTrack", () => {
  it("is off without a key", () => {
    expect(shouldTrack({}, {})).toBe(false);
  });
  it("is on with a key", () => {
    expect(shouldTrack({ key: "phc_x" }, { doNotTrack: "0" })).toBe(true);
  });
  it("respects Do Not Track and Global Privacy Control", () => {
    expect(shouldTrack({ key: "phc_x" }, { doNotTrack: "1" })).toBe(false);
    expect(shouldTrack({ key: "phc_x" }, { globalPrivacyControl: true })).toBe(false);
  });
});
