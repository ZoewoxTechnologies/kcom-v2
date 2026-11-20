import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./rich-text.js";

const IMG = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("sanitizeRichText images", () => {
  it("keeps a Cloudinary image with src and alt only", () => {
    const input = doc({ type: "image", attrs: { src: IMG, alt: "Pic", title: "x", onerror: "y" } });
    expect(sanitizeRichText(input)).toEqual(
      doc({ type: "image", attrs: { src: IMG, alt: "Pic" } }),
    );
  });

  it("drops images from other hosts and non-https sources", () => {
    for (const src of [
      "https://evil.test/a.png",
      "http://res.cloudinary.com/demo/image/upload/a.jpg",
      "data:image/png;base64,AA",
      undefined,
    ]) {
      expect(sanitizeRichText(doc({ type: "image", attrs: { src } }))).toEqual(doc());
    }
  });
});
