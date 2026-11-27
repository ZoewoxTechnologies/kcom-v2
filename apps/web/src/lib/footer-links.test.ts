import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
});
