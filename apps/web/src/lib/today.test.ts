import { describe, expect, it } from "vitest";
import { withFallback } from "./data/client";
import { createSampleSource } from "./data/sample";
import { emptySource } from "./data/client";
import { todaysCapsule } from "./today";

describe("todaysCapsule", () => {
  const sample = createSampleSource(() => new Date("2026-11-23T10:00:00Z"));

  it("returns the capsule of the day when it exists", async () => {
    expect((await todaysCapsule(sample, "2026-11-23"))?.displayDate).toBe("2026-11-23");
  });

  it("falls back to the latest published capsule on a gap day", async () => {
    const latest = await sample.latestCapsule();
    const c = await todaysCapsule(sample, "2099-01-01");
    expect(c?.slug).toBe(latest?.slug);
  });

  it("is one answer for every reader, even when the API lacks today and a fallback has it", async () => {
    const api = {
      ...emptySource,
      latestCapsule: async () => ({
        ...(await sample.latestCapsule())!,
        slug: "api-17-nov",
        displayDate: "2026-11-17",
      }),
    };
    const src = withFallback(api, sample);
    const a = await todaysCapsule(src, "2026-11-23");
    const b = await todaysCapsule(src, "2026-11-23");
    expect(a?.displayDate).toBe(b?.displayDate);
  });

  it("is null with no data", async () => {
    expect(await todaysCapsule(emptySource, "2026-11-23")).toBeNull();
  });
});
