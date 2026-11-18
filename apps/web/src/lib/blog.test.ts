import { describe, expect, it } from "vitest";
import { allBlogPosts, postKicker, readingMinutes, relatedPosts } from "./blog";
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
  it("walks every page of the API", async () => {
    const many = Array.from({ length: 230 }, (_, i) => ({ slug: `p${i}`, title: "", date: "2026-01-01", excerpt: null, heroImageUrl: null, tags: [] }));
    const src = { ...sampleSource, listBlogPosts: async ({ limit = 20, offset = 0 } = {}) => many.slice(offset, offset + limit) };
    expect(await allBlogPosts(src)).toHaveLength(230);
  });
  it("lists related posts without the current one", async () => {
    const post = sampleBlogPosts[0]!;
    const rel = await relatedPosts(sampleSource, post);
    expect(rel).toHaveLength(3);
    expect(rel.some((r) => r.slug === post.slug)).toBe(false);
  });
});
