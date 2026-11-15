import { describe, expect, it } from "vitest";
import { initSentry } from "./sentry";

describe("initSentry", () => {
  it("is a no-op without a DSN", () => {
    expect(initSentry({})).toBe(false);
  });
});
