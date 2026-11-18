import { describe, expect, it } from "vitest";
import { loadBlogPage, parsePage, postKicker, readingMinutes, relatedPosts } from "./blog";
import { sampleSource } from "./data/sample";
import { sampleBlogPosts } from "./data/sample-blog";

describe("blog helpers", () => {
  it("reads at least a minute", () => {
    expect(readingMinutes({ type: "doc", content: [] })).toBe(1);
    const words = Array(450).fill("word").join(" ");
    expect(readingMinutes({ type: "paragraph", content: [{ text: words }] })).toBe(2);
  });
  it("builds the kicker from the first tag and date", () => {
    expect(postKicker({ tags: ["Teaching"], date: "2026-01-01" })).toBe("Teaching · 1 January 2026");
    expect(postKicker({ tags: [], date: "2026-01-01" })).toBe("1 January 2026");
  });
  it("parses page numbers defensively", () => {
    expect([null, "0", "-1", "x", "1.5", "3"].map(parsePage)).toEqual([1, 1, 1, 1, 1, 3]);
  });
  it("pages with a look-ahead row", async () => {
    const first = await loadBlogPage(sampleSource, 1, 2);
    expect(first.posts).toHaveLength(2);
    expect(first).toMatchObject({ hasPrev: false, hasNext: true });
    const last = await loadBlogPage(sampleSource, 3, 2);
    expect(last).toMatchObject({ hasPrev: true, hasNext: false });
    expect(last.posts).toHaveLength(1);
  });
  it("lists related posts without the current one", async () => {
    const post = sampleBlogPosts[0]!;
    const rel = await relatedPosts(sampleSource, post);
    expect(rel).toHaveLength(3);
    expect(rel.some((r) => r.slug === post.slug)).toBe(false);
  });
});
