import { describe, expect, it } from "vitest";
import { aboutRecords, blogRecord, capsuleRecord, plain } from "./search-index";

const doc = (t: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

describe("search index records", () => {
  it("flattens rich text", () => {
    expect(plain({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }, { type: "paragraph", content: [{ type: "text", text: "b" }] }] })).toBe("a b");
    expect(plain("  x   y ")).toBe("x y");
  });
  it("builds a capsule record with year and series filters", () => {
    const r = capsuleRecord({ slug: "s", title: "T", displayDate: "2026-11-14", scriptureRef: "Romans 12:2", body: doc("renew"), decrees: ["d"] }, "Series A");
    expect(r).toMatchObject({ url: "/capsules/s", meta: { type: "Capsule", date: "2026-11-14" }, filters: { type: ["Capsule"], year: ["2026"], series: ["Series A"] } });
    expect(r.content).toContain("renew");
  });
  it("builds blog and About records", () => {
    expect(blogRecord({ slug: "p", title: "P", date: "2026-01-01T00:00:00Z", excerpt: "e", tags: ["x"] }).filters.year).toEqual(["2026"]);
    expect(aboutRecords.map((r) => r.url)).toEqual(["/about", "/about/team"]);
  });
});
