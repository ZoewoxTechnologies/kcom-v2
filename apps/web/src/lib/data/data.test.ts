import { describe, expect, it, vi } from "vitest";
import { createApiSource, emptySource, richTextToPlain, withFallback } from "./client";
import { resolveSource } from "./index";
import { sampleCapsule, sampleSource } from "./sample";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fetchOf = (r: () => Response | Promise<Response>) => vi.fn<typeof fetch>(async () => r());

describe("api source", () => {
  it("picks the summary from the latest capsule response", async () => {
    const f = fetchOf(() =>
      json({ slug: "a", title: "A", displayDate: "2026-01-02", scriptureRef: "John 1:1", scriptureText: { content: [{ text: "In the beginning" }] }, seriesId: null }),
    );
    const c = await createApiSource("http://api/", f).latestCapsule();
    expect(String(f.mock.calls[0]![0])).toBe("http://api/capsules/latest");
    expect(c).toEqual({ slug: "a", title: "A", displayDate: "2026-01-02", scriptureRef: "John 1:1", scriptureText: "In the beginning" });
  });
  it("treats 404 as null and other errors as failures", async () => {
    expect(await createApiSource("http://api", fetchOf(() => json({}, 404))).latestCapsule()).toBeNull();
    await expect(createApiSource("http://api", fetchOf(() => json({}, 500))).latestCapsule()).rejects.toThrow("500");
  });
  it("flattens rich text", () => {
    expect(richTextToPlain({ type: "doc", content: [{ type: "paragraph", content: [{ text: "a" }] }, { type: "paragraph", content: [{ text: "b" }] }] })).toBe("a b");
    expect(richTextToPlain(null)).toBe("");
    const marked = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Trans" }, { type: "text", text: "formed", marks: [{ type: "bold" }] }, { type: "text", text: " by" }] }, { type: "paragraph", content: [{ type: "text", text: "grace" }] }] };
    expect(richTextToPlain(marked)).toBe("Transformed by grace");
  });
});

describe("fallback and switch", () => {
  const down: typeof sampleSource = { latestCapsule: async () => { throw new Error("down"); } };
  it("falls back to sample data on error", async () => {
    const onError = vi.fn();
    expect(await withFallback(down, sampleSource, onError).latestCapsule()).toEqual(sampleCapsule);
    expect(onError).toHaveBeenCalledOnce();
  });
  it("wraps every method, including ones added later", async () => {
    type Extra = { listThings(): Promise<string[]>; thing(): Promise<string | null> };
    const bad = { listThings: async () => { throw new Error("x"); }, thing: async () => null } as unknown as Extra;
    const good = { listThings: async () => ["a"], thing: async () => "t" } as unknown as Extra;
    const w = withFallback(bad as never, good as never) as unknown as Extra;
    expect(await w.listThings()).toEqual(["a"]);
    expect(await w.thing()).toBe("t");
    const none = withFallback(bad as never, null) as unknown as Extra;
    expect(await none.listThings()).toEqual([]);
    expect(await none.thing()).toBeNull();
    expect(await (emptySource as unknown as Extra).listThings()).toEqual([]);
  });
  it("production never shows sample content when the API is down or empty", async () => {
    expect(await withFallback(down, null).latestCapsule()).toBeNull();
    const empty = createApiSource("http://api", fetchOf(() => json({}, 404)));
    expect(await withFallback(empty, null).latestCapsule()).toBeNull();
  });
  it("DATA_SOURCE=sample serves sample data; no API URL does so only outside production", () => {
    expect(resolveSource({ DATA_SOURCE: "sample", PUBLIC_API_URL: "http://x" }, true)).toBe(sampleSource);
    expect(resolveSource({}, false)).toBe(sampleSource);
    expect(resolveSource({}, true)).toBe(emptySource);
    expect(resolveSource({ PUBLIC_API_URL: "http://x" }, false)).not.toBe(sampleSource);
  });
});
