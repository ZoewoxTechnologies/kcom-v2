import { describe, expect, it } from "vitest";
import { imageSrcSet, imageUrl, isCloudinaryImageUrl } from "./index.js";

const url = "https://res.cloudinary.com/demo/image/upload/v123/kcom/a.png";

describe("imageUrl", () => {
  it("defaults to auto format and quality", () => {
    expect(imageUrl(url)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v123/kcom/a.png",
    );
  });
  it("resizes", () => {
    expect(imageUrl(url, { width: 400, height: 300, fit: "fill", format: "webp" })).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_300,f_webp,q_auto/v123/kcom/a.png",
    );
  });
  it("leaves other URLs alone", () => {
    expect(imageUrl("https://example.org/a.png", { width: 10 })).toBe("https://example.org/a.png");
  });
  it("is not fooled by lookalike hosts", () => {
    for (const bad of [
      "https://evil.test/res.cloudinary.com/image/upload/a.png",
      "https://res.cloudinary.com.evil.test/image/upload/a.png",
      "http://res.cloudinary.com/demo/image/upload/a.png",
    ]) {
      expect(isCloudinaryImageUrl(bad)).toBe(false);
      expect(imageUrl(bad, { width: 10 })).toBe(bad);
    }
  });
  it("pins the cloud name when given", () => {
    expect(isCloudinaryImageUrl(url, "demo")).toBe(true);
    expect(isCloudinaryImageUrl(url, "other")).toBe(false);
    expect(
      isCloudinaryImageUrl("https://res.cloudinary.com/demo-evil/image/upload/a.png", "demo"),
    ).toBe(false);
  });
  it("builds a srcset", () => {
    expect(imageSrcSet(url, [320, 640])).toContain("w_320,f_auto,q_auto/v123/kcom/a.png 320w, ");
  });
});
