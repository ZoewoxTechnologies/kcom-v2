import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CapsuleView.astro", import.meta.url), "utf8");
const dropCapRules = source.split("\n").filter((l) => l.includes("::first-letter"));

describe("CapsuleView drop cap", () => {
  it("has exactly one drop-cap rule", () => {
    expect(dropCapRules).toHaveLength(1);
  });

  it("targets only direct paragraph children of the body, never list items or nested paragraphs", () => {
    const [rule] = dropCapRules;
    const selector = rule!.slice(0, rule!.indexOf("{")).trim();
    expect(selector).toBe(".capsule > .prose.body > :global(p:first-of-type)::first-letter");
  });

  it("marks only the body prose, not the prayer", () => {
    expect(source.match(/class="prose body"/g)).toHaveLength(1);
  });
});
