import { describe, expect, it } from "vitest";
import { responsiveImage } from "./responsive-image";

const base = "https://res.cloudinary.com/demo/image/upload/v1/kcom/a.jpg";

describe("responsiveImage", () => {
  it("builds a limited, auto-format srcset and a mid-width src", () => {
    const r = responsiveImage(base, { widths: [320, 640, 960] });
    expect(r.src).toBe("https://res.cloudinary.com/demo/image/upload/c_limit,w_640,f_auto,q_auto/v1/kcom/a.jpg");
    expect(r.srcset).toBe(
      [320, 640, 960]
        .map((w) => `https://res.cloudinary.com/demo/image/upload/c_limit,w_${w},f_auto,q_auto/v1/kcom/a.jpg ${w}w`)
        .join(", "),
    );
  });

  it("honours an explicit fallback width", () => {
    expect(responsiveImage(base, { widths: [320, 640], fallbackWidth: 320 }).src).toContain("w_320,");
  });

  it("leaves non-Cloudinary URLs alone, without a srcset", () => {
    const url = "https://example.com/pic.jpg";
    expect(responsiveImage(url, { widths: [320, 640] })).toEqual({ src: url });
  });

  it("does not treat lookalike hosts as Cloudinary", () => {
    const url = "https://res.cloudinary.com.evil.test/demo/image/upload/a.jpg";
    expect(responsiveImage(url, { widths: [320] })).toEqual({ src: url });
  });

  it("crops every variant to the ratio with c_fill", () => {
    const r = responsiveImage(base, { widths: [320, 640], ratio: 16 / 10 });
    expect(r.srcset).toBe(
      [[320, 200], [640, 400]]
        .map(([w, h]) => `https://res.cloudinary.com/demo/image/upload/c_fill,w_${w},h_${h},f_auto,q_auto/v1/kcom/a.jpg ${w}w`)
        .join(", "),
    );
    expect(r.src).toContain("c_fill,w_640,h_400,");
  });
});
