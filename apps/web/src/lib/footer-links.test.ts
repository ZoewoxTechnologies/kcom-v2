import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@kcom/db/test-db";
import { createApp } from "@kcom/api/app";
import { createApiSource } from "./data/client";
import { footerColumns } from "./site";

/** Every footer link, including the ones SiteFooter adds itself. */
const footerHrefs = [
  ...footerColumns.flatMap((c) => c.links.map((l) => l.href)),
  "/contact",
  "/privacy",
];

const pagesDir = fileURLToPath(new URL("../pages/", import.meta.url));
const hasRoute = (href: string) => {
  const p = href.replace(/^\//, "");
  return [`${p}.astro`, `${p}/index.astro`].some((f) => existsSync(pagesDir + f));
};

describe("footer links", () => {
  it("each one has a page route", () => {
    for (const href of footerHrefs) expect(hasRoute(href), href).toBe(true);
  });

  it("the privacy page exists in a freshly migrated API database", async () => {
    const app = createApp(await createTestDb(), {
      corsOrigins: [],
      auth: { secret: "x".repeat(40), baseURL: "http://api.test" },
    });
    const source = createApiSource("http://api.test", async (input, init) =>
      app.request(input instanceof Request ? input : String(input), init),
    );
    const page = await source.pageBySlug("privacy");
    expect(page?.title).toBe("Privacy policy");
    expect(JSON.stringify(page?.body)).toContain("What we collect");
  });
});
