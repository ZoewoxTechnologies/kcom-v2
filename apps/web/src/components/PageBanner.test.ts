import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import PageBanner from "./PageBanner.astro";

const render = async (props: Record<string, unknown>) =>
  (await AstroContainer.create()).renderToString(PageBanner, { props });

describe("PageBanner", () => {
  it("uses the section photo with AVIF and WebP sources by default", async () => {
    const html = await render({ title: "Blog", section: "blog" });
    expect(html).toContain("/banners/blog-1600.avif");
    expect(html).toContain("/banners/blog-1600.webp");
    expect(html).not.toContain("compact");
  });

  it("uses the item's own image when given, and the compact size", async () => {
    const html = await render({
      title: "A post",
      section: "blog",
      image: "https://example.org/pic.jpg",
      size: "compact",
    });
    expect(html).toContain("example.org/pic.jpg");
    expect(html).not.toContain("/banners/blog-1600");
    expect(html).toContain("compact");
  });
});
