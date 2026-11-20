import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import BaseLayout from "./BaseLayout.astro";
import { navItems } from "../lib/nav";

describe("BaseLayout", () => {
  it("renders header, nav, small CTA and footer around the page", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, {
      props: { title: "Test" },
      slots: { default: "<p>page body</p>" },
    });
    expect(html).toContain('class="skip-link"');
    expect(html).toContain("<header");
    for (const l of navItems.flatMap((i) => [i, ...(i.children ?? [])])) expect(html).toContain(`href="${l.href}"`);
    expect(html).toContain("popovertarget");
    expect(html).not.toMatch(/ClientRouter|view-transition|astro-route-announcer/i);
    expect(html).not.toContain("Gallery");
    expect(html).toMatch(/class="[^"]*kc-btn kc-btn--primary kc-btn--sm[^"]*"/);
    expect(html).toContain("page body");
    expect(html).toContain("<footer");
    expect(html).toContain(`© ${new Date().getFullYear()}`);
    expect(html).toContain("<title>Test | Kingdom Capstone Outreach Ministries</title>");
  });
  it("links the search button, offers the Dark theme and omits placeholder contact text", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, { props: { title: "Test" } });
    expect(html).toMatch(/class="search"[^>]*href="\/search"|href="\/search"[^>]*class="search"/);
    expect(html).toContain(">Dark<");
    expect(html).not.toContain("coming soon");
  });

  it("shows the footer signup unless the page has its own", async () => {
    const container = await AstroContainer.create();
    const withFooter = await container.renderToString(BaseLayout, { props: {} });
    const without = await container.renderToString(BaseLayout, { props: { hideSignup: true } });
    expect(withFooter).toContain('id="footer-email"');
    expect(without).not.toContain('id="footer-email"');
  });

  it("opens the phone menu with an icon-only toggle", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseLayout, { props: { title: "Test" } });
    expect(html).toMatch(/<summary[^>]*aria-label="Open menu"[^>]*aria-expanded="false"/);
    expect(html).not.toContain(">Menu<");
  });
});
