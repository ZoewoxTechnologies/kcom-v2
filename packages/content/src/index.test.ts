import { describe, expect, it } from "vitest";
import { capsuleSchema, settingsSchema } from "./index";

describe("capsuleSchema", () => {
  const valid = {
    id: "c1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    slug: "peace-be-still",
    title: "Peace, be still",
    status: "published",
    publishedAt: "2026-01-01T00:00:00Z",
    date: "2026-01-01",
    body: "…",
  };

  it("accepts a valid capsule", () => {
    expect(capsuleSchema.parse(valid).date).toBe("2026-01-01");
  });

  it("rejects a bad slug", () => {
    expect(capsuleSchema.safeParse({ ...valid, slug: "Not A Slug" }).success).toBe(false);
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
