import { describe, expect, it } from "vitest";
import { SERIES_WINDOW, loadCapsulePage, onThisDay, seriesContext } from "./capsule-page";
import { createSampleSource } from "./data/sample";
import type { Capsule } from "./data";

const src = createSampleSource(() => new Date("2026-11-17T10:00:00Z"));
const get = async (slug: string): Promise<Capsule> => (await src.capsuleBySlug(slug))!;

describe("capsule page data", () => {
  it("lists the series with its parts in order and the capsule's own series", async () => {
    const p = await loadCapsulePage(src, await get("the-renewed-mind-day-9"));
    expect(p.seriesInfo?.series.title).toBe("The Renewed Mind");
    expect(p.seriesInfo?.members.map((m) => m.partNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(p.seriesInfo?.truncated).toBe(false);
  });
  it("takes previous and next from the source, with null at the ends", async () => {
    const mid = await loadCapsulePage(src, await get("the-renewed-mind-day-9"));
    expect(mid.prev?.slug).toBe("the-renewed-mind-day-8");
    expect(mid.next?.slug).toBe("the-renewed-mind-day-10");
    expect((await loadCapsulePage(src, await get("the-renewed-mind-day-12"))).next).toBeNull();
  });
  it("skips days with no capsule", async () => {
    // "Walking in Dominion" ends 20 days ago, so its last day sits well before the next series' first day
    const last = await get("walking-in-dominion-day-14");
    const { next } = await loadCapsulePage(src, last);
    expect(next?.slug).toBe("the-renewed-mind-day-1");
    expect(next!.displayDate > last.displayDate).toBe(true);
  });
  it("windows a long series around the current capsule", async () => {
    const long = { ...src, seriesBySlug: async () => ({
      series: (await src.listSeries())[0]!,
      capsules: Array.from({ length: 100 }, (_, i) => ({ slug: `s${i}`, title: `t${i}`, displayDate: "2026-01-01", scriptureRef: null, partNumber: i + 1, seriesTitle: "x" })),
    }) };
    const c = { ...(await get("the-renewed-mind-day-9")), slug: "s50" };
    const ctx = (await seriesContext(long, c))!;
    expect(ctx.truncated).toBe(true);
    expect(ctx.members).toHaveLength(SERIES_WINDOW);
    expect(ctx.members.map((m) => m.slug)).toContain("s50");
  });
  it("has no series info for a standalone capsule and no past years in sample data", async () => {
    const p = await loadCapsulePage(src, (await src.capsuleBySlug("be-ye-transformed"))!);
    expect(p.seriesInfo).toBeNull();
    expect(await onThisDay(src, "2026-11-14")).toEqual([]);
  });
});
