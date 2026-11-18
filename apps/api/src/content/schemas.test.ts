import { describe, expect, it } from "vitest";
import { cloudinaryImageUrl } from "./schemas.js";

describe("cloudinaryImageUrl", () => {
  it("accepts Cloudinary delivery URLs", () => {
    expect(
      cloudinaryImageUrl.safeParse("https://res.cloudinary.com/demo/image/upload/v1/kcom/a.png")
        .success,
    ).toBe(true);
  });

  it.each([
    "https://example.org/a.png",
    "http://res.cloudinary.com/demo/image/upload/a.png",
    "https://res.cloudinary.com.evil.test/demo/image/upload/a.png",
    "https://evil.test/res.cloudinary.com/image/upload/a.png",
    "javascript:alert(1)",
    "not a url",
  ])("rejects %s", (url) => {
    expect(cloudinaryImageUrl.safeParse(url).success).toBe(false);
  });
});
