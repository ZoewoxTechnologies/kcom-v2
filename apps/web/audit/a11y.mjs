// WCAG 2.2 AA audit: runs axe on every key public page in light and dark, at phone and desktop widths.
// Usage: BASE_URL=http://127.0.0.1:4321 node audit/a11y.mjs  (PW_CHANNEL=chrome uses a local Chrome)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = (process.env.BASE_URL ?? "http://127.0.0.1:4321").replace(/\/+$/, "");
const pages = JSON.parse(readFileSync(new URL("./pages.json", import.meta.url), "utf8"));
const sizes = { phone: { width: 375, height: 812 }, desktop: { width: 1280, height: 900 } };
const browser = await chromium.launch(
  process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {},
);
let failures = 0;

for (const theme of ["light", "dark"]) {
  for (const [name, viewport] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {
        /* storage unavailable */
      }
    }, theme);
    for (const path of pages) {
      const page = await context.newPage();
      await page.goto(base + path, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      for (const v of results.violations) {
        failures++;
        console.error(`FAIL [${theme}/${name}] ${path}: ${v.id} (${v.impact}) ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) console.error(`    ${n.target.join(" ")}`);
      }
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
if (failures) {
  console.error(`${failures} accessibility violation(s)`);
  process.exit(1);
}
console.log(`axe: no WCAG AA violations on ${pages.length} pages x 2 themes x 2 widths`);
