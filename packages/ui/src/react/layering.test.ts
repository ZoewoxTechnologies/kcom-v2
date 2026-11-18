import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const zIndexes = (file: string) =>
  [
    ...readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8").matchAll(
      /z-index:\s*(\d+)/g,
    ),
  ].map((m) => Number(m[1]));

describe("layering", () => {
  it("toasts sit above dialogs, so errors raised from an open editor are visible", () => {
    expect(Math.min(...zIndexes("toast.css"))).toBeGreaterThan(Math.max(...zIndexes("dialog.css")));
  });
});
