import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import BaseLayout from "./BaseLayout.astro";
import { navLinks } from "../lib/site";

describe("BaseLayout", () => {
  it("renders header, nav, small CTA and footer around the page", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: "Test" },
      slots: { default: "<p>page body</p>" },
    });
    expect(html).toContain('class="skip-link"');
    expect(html).toContain("<header");
    for (const l of navLinks) expect(html).toContain(`href="${l.href}"`);
    expect(html).toMatch(/class="[^"]*kc-btn kc-btn--primary kc-btn--sm[^"]*"/);
    expect(html).toContain("page body");
    expect(html).toContain("<footer");
    expect(html).toContain(`© ${new Date().getFullYear()}`);
    expect(html).toContain("<title>Test | Kingdom Capstone Outreach Ministries</title>");
  });
});
