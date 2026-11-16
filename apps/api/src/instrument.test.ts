import { describe, expect, it } from "vitest";
import { initSentry } from "./instrument.js";

describe("initSentry", () => {
  it("is a no-op without a DSN", () => {
    expect(initSentry({})).toBe(false);
  });
});
