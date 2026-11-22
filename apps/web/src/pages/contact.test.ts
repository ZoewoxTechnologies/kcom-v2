import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactDetails } from "../lib/data/types";
import ContactPage from "./contact.astro";

let details: ContactDetails | null;
vi.mock("../lib/footer-contact", () => ({ footerContact: { get: async () => details } }));

const render = async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(ContactPage);
  // Scope to the page's own card; the footer also shows contact details.
  return html.match(/<h2[^>]*>Other ways to reach us<\/h2>[\s\S]*?<\/div>/)?.[0] ?? null;
};

describe("contact page card", () => {
  beforeEach(() => {
    details = null;
  });

  it("shows linked, formatted details and social links from settings", async () => {
    details = {
      email: "hi@kcom.org",
      phone: "+2348058009879",
      address: "1 Main St",
      social: [
        { label: "Facebook", href: "https://facebook.com/kcom" },
        { label: "YouTube", href: "https://youtube.com/@kcom" },
      ],
    };
    const card = await render();
    expect(card).toContain('href="mailto:hi@kcom.org"');
    expect(card).toContain('href="tel:+2348058009879"');
    expect(card).toContain("+234 805 800 9879");
    expect(card).toContain("1 Main St");
    expect(card).toContain('href="https://facebook.com/kcom"');
    expect(card).toContain('href="https://youtube.com/@kcom"');
    expect(card).not.toContain("example.org");
  });

  it("hides empty fields", async () => {
    details = { email: null, phone: null, address: "1 Main St", social: [] };
    const card = await render();
    expect(card).toContain("1 Main St");
    expect(card).not.toContain("Email");
    expect(card).not.toContain("Phone");
  });

  it("hides the whole card when everything is empty", async () => {
    details = { email: null, phone: null, address: null, social: [] };
    expect(await render()).toBeNull();
    details = null;
    expect(await render()).toBeNull();
  });
});
