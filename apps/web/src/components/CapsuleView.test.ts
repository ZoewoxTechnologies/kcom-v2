import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import CapsuleView from "./CapsuleView.astro";
import { loadCapsulePage } from "../lib/capsule-page";
import { createSampleSource } from "../lib/data/sample";

const src = createSampleSource(() => new Date("2026-11-17T10:00:00Z"));

async function render(mode: "today" | "past"): Promise<string> {
  const capsule = (await src.capsuleBySlug("the-renewed-mind-day-2"))!;
  const page = await loadCapsulePage(src, capsule);
  const container = await AstroContainer.create();
  return container.renderToString(CapsuleView, { props: { page, mode, today: "2026-11-17", shareUrl: "https://example.org/x" } });
}

const proseDivs = (html: string) => [...html.matchAll(/<div class="([^"]*\bprose\b[^"]*)"/g)].map((m) => m[1]!);

describe("CapsuleView drop cap", () => {
  it("marks only the body, and only in today mode", async () => {
    const today = proseDivs(await render("today"));
    expect(today.filter((c) => c.includes("dropcap"))).toHaveLength(1);
    expect(proseDivs(await render("past")).some((c) => c.includes("dropcap"))).toBe(false);
  });

  it("has a single drop-cap rule scoped to the first direct paragraph of the dropcap body", () => {
    const source = readFileSync(new URL("./CapsuleView.astro", import.meta.url), "utf8");
    const rules = source.split("\n").filter((l) => l.includes("::first-letter"));
    expect(rules).toHaveLength(1);
    expect(rules[0]!.slice(0, rules[0]!.indexOf("{")).trim()).toBe(".capsule > .prose.dropcap > :global(p:first-child)::first-letter");
  });
});
