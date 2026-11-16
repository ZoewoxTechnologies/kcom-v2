import { describe, expect, it } from "vitest";
import { capsuleSchema, settingsSchema } from "./index";

describe("capsuleSchema", () => {
  const valid = {
    id: "c1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    slug: "peace-be-still",
    title: "Peace, be still",
    status: "scheduled",
    publishAt: "2026-01-01T23:00:00Z",
    body: {},
  };

  it("accepts a valid capsule and defaults optional fields", () => {
    const c = capsuleSchema.parse(valid);
    expect(c.publishAt).toEqual(new Date("2026-01-01T23:00:00Z"));
    expect(c.decrees).toEqual([]);
    expect(c.seriesId).toBeNull();
    expect(c.bibleMeditation).toBeNull();
  });

  it("rejects a bad slug, blank title, unknown status and missing publishAt", () => {
    expect(capsuleSchema.safeParse({ ...valid, slug: "Not A Slug" }).success).toBe(false);
    expect(capsuleSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(capsuleSchema.safeParse({ ...valid, status: "archived" }).success).toBe(false);
    expect(capsuleSchema.safeParse({ ...valid, publishAt: undefined }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("defaults optional fields to null", () => {
    expect(settingsSchema.parse({ siteName: "Site" }).facebookUrl).toBeNull();
  });

  it("rejects a bad email and non-http URLs", () => {
    expect(() => settingsSchema.parse({ siteName: "S", contactEmail: "nope" })).toThrow();
    expect(() => settingsSchema.parse({ siteName: "S", xUrl: "ftp://x.com" })).toThrow();
    expect(() =>
      settingsSchema.parse({ siteName: "S", telegramUrl: "https://t.me/x" }),
    ).not.toThrow();
  });
});
