import { describe, expect, it, vi } from "vitest";
import { createApiSource, richTextToPlain, withFallback } from "./client";
import { resolveSource } from "./index";
import { sampleCapsule, sampleSource } from "./sample";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("api source", () => {
  it("maps the latest capsule", async () => {
    const f = vi.fn<typeof fetch>(async () =>
      json({ slug: "a", title: "A", displayDate: "2026-01-02", scriptureRef: "John 1:1", scriptureText: { content: [{ text: "In the beginning" }] }, seriesId: null }),
    );
    const c = await createApiSource("http://api/", f).latestCapsule();
    expect(f.mock.calls[0]![0]).toBe("http://api/capsules/latest");
    expect(c).toMatchObject({ slug: "a", scriptureText: "In the beginning" });
  });
  it("treats 404 as empty and other errors as failures", async () => {
    const src = (status: number) => createApiSource("http://api", (async () => json({}, status)) as unknown as typeof fetch);
    expect(await src(404).latestCapsule()).toBeNull();
    expect(await src(404).listSeries()).toEqual([]);
    await expect(src(500).latestCapsule()).rejects.toThrow("500");
  });
  it("flattens rich text", () => {
    expect(richTextToPlain({ content: [{ content: [{ text: "a" }] }, { text: "b" }] })).toBe("a b");
    expect(richTextToPlain(null)).toBe("");
  });
});

describe("fallback and switch", () => {
  it("falls back to sample data on error or empty", async () => {
    const onError = vi.fn();
    const bad = { latestCapsule: async () => { throw new Error("down"); }, listSeries: async () => [] };
    const s = withFallback(bad, sampleSource, onError);
    expect(await s.latestCapsule()).toEqual(sampleCapsule);
    expect((await s.listSeries()).length).toBeGreaterThan(0);
    expect(onError).toHaveBeenCalledOnce();
  });
  it("DATA_SOURCE=sample or no API URL serves sample data", () => {
    expect(resolveSource({ DATA_SOURCE: "sample", PUBLIC_API_URL: "http://x" })).toBe(sampleSource);
    expect(resolveSource({})).toBe(sampleSource);
    expect(resolveSource({ PUBLIC_API_URL: "http://x" })).not.toBe(sampleSource);
  });
});
