import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Pagination from "@kcom/ui/astro/Pagination.astro";

const render = async (props: Record<string, unknown>) =>
  (await AstroContainer.create()).renderToString(Pagination, { props });

describe("Pagination", () => {
  it("renders nothing for a single page", async () => {
    expect((await render({ page: 1, pages: 1, path: "/blog" })).trim()).toBe("");
  });

  it("marks the current page and hides the inert prev control on page 1", async () => {
    const html = await render({ page: 1, pages: 3, path: "/blog" });
    expect(html).toMatch(/href="\/blog"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/blog"/);
    expect(html).toContain('rel="next"');
    expect(html).not.toContain('rel="prev"');
    expect(html).not.toContain("aria-disabled");
    expect(html).toContain('aria-hidden="true"');
  });

  it("centers only when asked", async () => {
    expect(await render({ page: 2, pages: 3, path: "/blog" })).not.toContain("kc-pagination--center");
    expect(await render({ page: 2, pages: 3, path: "/blog", centered: true })).toContain(
      "kc-pagination--center",
    );
  });
});
