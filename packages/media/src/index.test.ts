import { describe, expect, it } from "vitest";
import { imageSrcSet, imageUrl } from "./index.js";

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
  it("builds a srcset", () => {
    expect(imageSrcSet(url, [320, 640])).toContain("w_320,f_auto,q_auto/v123/kcom/a.png 320w, ");
  });
});
