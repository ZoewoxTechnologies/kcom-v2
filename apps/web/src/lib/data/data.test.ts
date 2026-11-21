import { describe, expect, it, vi } from "vitest";
import { dataMethods, dataMethodsComplete } from "./types";
import { createApiSource, emptySource, richTextToPlain, withFallback } from "./client";
import { resolveSource } from "./index";
import { sampleSource } from "./sample";

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
  it("treats a malformed latest capsule as none, so the verse bar never shows an invalid date", async () => {
    for (const body of [[], {}, { slug: "a", title: "A", displayDate: "", scriptureRef: null }, { slug: "a", title: "A", displayDate: "soon", scriptureRef: null }]) {
      expect(await createApiSource("http://api", fetchOf(() => json(body))).latestCapsule()).toBeNull();
    }
  });
  it("flattens rich text", () => {
    expect(richTextToPlain({ type: "doc", content: [{ type: "paragraph", content: [{ text: "a" }] }, { type: "paragraph", content: [{ text: "b" }] }] })).toBe("a b");
    expect(richTextToPlain(null)).toBe("");
    const marked = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Trans" }, { type: "text", text: "formed", marks: [{ type: "bold" }] }, { type: "text", text: " by" }] }, { type: "paragraph", content: [{ type: "text", text: "grace" }] }] };
    expect(richTextToPlain(marked)).toBe("Transformed by grace");
  });
});

describe("fallback and switch", () => {
  const down: typeof sampleSource = { ...emptySource, latestCapsule: async () => { throw new Error("down"); } };
  it("falls back to sample data on error", async () => {
    const onError = vi.fn();
    expect(await withFallback(down, sampleSource, onError).latestCapsule()).toEqual(await sampleSource.latestCapsule());
    expect(onError).toHaveBeenCalledOnce();
  });
  it("is not a thenable: awaiting a wrapped source resolves", async () => {
    const w = withFallback(down, null);
    expect(await Promise.resolve(w)).toBe(w);
    expect(await Promise.resolve(emptySource)).toBe(emptySource);
  });
  it("wrappers expose every listed method", () => {
    expect(dataMethodsComplete).toBe(true);
    for (const m of dataMethods) {
      expect(typeof withFallback(down, null)[m]).toBe("function");
      expect(typeof emptySource[m]).toBe("function");
    }
  });
  it("applies the same fallback to every listed method", async () => {
    for (const m of dataMethods) {
      const got = await (withFallback({ ...down, [m]: async () => { throw new Error("down"); } }, null)[m] as () => Promise<unknown>)();
      expect(got).toEqual(m.startsWith("list") ? [] : null);
    }
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

describe("archive reads", () => {
  const cap = (slug: string, day: string, seriesId: string | null, partNumber: number | null) => ({
    slug, title: slug, displayDate: day, scriptureRef: null, seriesId, partNumber,
  });
  const info = { id: "s1", slug: "ser", title: "Ser", description: "d", capsuleCount: 3, firstDate: "2026-11-01", lastDate: "2026-11-16", latestPart: 3 };
  const apiFetch = (all: ReturnType<typeof cap>[]) =>
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/series") return json([info]);
      if (url.pathname === "/series/ser") return json(info);
      if (url.pathname === "/series/nope") return json({}, 404);
      const month = url.searchParams.get("month");
      const series = url.searchParams.get("series");
      const rows = all.filter((c) => (!month || c.displayDate.startsWith(month)) && (!series || (series === "ser" && c.seriesId === "s1")));
      const offset = Number(url.searchParams.get("offset"));
      return json(rows.slice(offset, offset + Number(url.searchParams.get("limit"))));
    });
  // 250 capsules force three pages of 100.
  const many = Array.from({ length: 250 }, (_, i) => cap(`c${i}`, `2026-11-${String((i % 28) + 1).padStart(2, "0")}`, i < 3 ? "s1" : null, i < 3 ? 3 - i : null));
  const now = () => new Date("2026-11-17T10:00:00Z");

  it("reads every page of a month and names the series", async () => {
    const items = await createApiSource("http://api", apiFetch(many)).listCapsulesInMonth("2026-11");
    expect(items).toHaveLength(250);
    expect(items.find((c) => c.slug === "c0")?.seriesTitle).toBe("Ser");
  });
  it("lists series from one API call, using the API's counts", async () => {
    const f = apiFetch(many);
    const list = await createApiSource("http://api", f, now).listSeries();
    expect(f).toHaveBeenCalledTimes(1);
    expect(list).toEqual([{ slug: "ser", title: "Ser", description: "d", count: 3, firstDate: "2026-11-01", lastDate: "2026-11-16", inProgress: true, latestPart: 3 }]);
  });
  it("series detail is in Day order; unknown series is null", async () => {
    const f = apiFetch(many);
    const d = await createApiSource("http://api", f, now).seriesBySlug("ser");
    expect(d?.capsules.map((c) => c.partNumber)).toEqual([1, 2, 3]);
    expect(await createApiSource("http://api", f).seriesBySlug("nope")).toBeNull();
  });
});

describe("pageBody", () => {
  it("joins richText sections, turning headings into level-2 headings", async () => {
    const { pageBody } = await import("./client");
    const para = { type: "paragraph", content: [{ type: "text", text: "Hello" }] };
    const doc = pageBody([
      { type: "hero", props: {} },
      { type: "richText", props: { heading: "Data", body: { type: "doc", content: [para] } } },
      { type: "richText", props: { body: { type: "doc", content: [para] } } },
    ]);
    expect(doc).toEqual({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Data" }] }, para, para],
    });
  });
});
