import { describe, expect, it } from "vitest";
import { renderShareImage, SHARE_HEIGHT, SHARE_WIDTH, titleSize } from "./share-image";

describe("share image", () => {
  it("renders a 1200x630 PNG", async () => {
    const png = await renderShareImage({ title: "Walking in Grace", kicker: "Romans 5:2", footer: "14 November 2026" });
    expect(Buffer.from(png.slice(0, 8)).toString("hex")).toBe("89504e470d0a1a0a");
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([SHARE_WIDTH, SHARE_HEIGHT]);
  });
  it("shrinks long titles", () => {
    expect(titleSize("x".repeat(100))).toBeLessThan(titleSize("short"));
  });
});
