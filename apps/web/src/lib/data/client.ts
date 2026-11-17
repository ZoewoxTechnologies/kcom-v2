import { hc } from "hono/client";
import type { App } from "@kcom/api/app";
import { inSeriesOrder, summarizeSeries } from "./series";
import type { CapsuleListItem, CapsuleSummary, DataSource, SeriesSummary } from "./types";

/** Plain text of a rich-text document (concatenated text nodes). */
export function richTextToPlain(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text;
  const kids = Array.isArray(n.content) ? n.content : [];
  return kids.map(richTextToPlain).join(" ").replace(/\s+/g, " ").trim();
}

type Fetch = typeof fetch;
const PAGE = 100;
const CACHE_MS = 5 * 60 * 1000;

/**
 * Reads the public API through its own route types, so response shapes cannot drift.
 * A 404 is null; other failures throw.
 */
export function createApiSource(baseUrl: string, fetchImpl: Fetch = fetch, now: () => Date = () => new Date()): DataSource {
  const client = hc<App>(baseUrl.replace(/\/+$/, ""), { fetch: fetchImpl });
  // The API's validators type every input (json, query, param) as required on each route, so
  // the typed call arguments are cast; the responses stay fully typed.
  const signal = () => ({ init: { signal: AbortSignal.timeout(10000) } });

  type Row = Awaited<ReturnType<Awaited<ReturnType<typeof client.capsules.$get>>["json"]>>[number];
  const toItem = (c: Row, titleOf: Map<string, string>): CapsuleListItem => ({
    slug: c.slug,
    title: c.title,
    displayDate: c.displayDate,
    scriptureRef: c.scriptureRef,
    partNumber: c.partNumber,
    seriesTitle: (c.seriesId && titleOf.get(c.seriesId)) || null,
  });

  /** Walks the paginated capsule list to the end. */
  async function allCapsules(query: { month?: string; series?: string }): Promise<Row[]> {
    const out: Row[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await client.capsules.$get({ query: { ...query, limit: String(PAGE), offset: String(offset) } } as never, signal());
      if (!res.ok) throw new Error(`API /capsules responded ${res.status}`);
      const rows = await res.json();
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  async function allSeries() {
    const res = await client.series.$get(undefined, signal());
    if (!res.ok) throw new Error(`API /series responded ${res.status}`);
    return res.json();
  }

  // The series list needs a count for every series, so it reads the whole archive once and
  // keeps the result briefly. Failures are never cached.
  let cached: { at: number; value: Promise<SeriesSummary[]> } | null = null;
  async function buildSeriesList(): Promise<SeriesSummary[]> {
    const [series, capsules] = await Promise.all([allSeries(), allCapsules({})]);
    const bySeries = new Map<string, typeof capsules>();
    for (const c of capsules) if (c.seriesId) bySeries.set(c.seriesId, [...(bySeries.get(c.seriesId) ?? []), c]);
    return series.flatMap((s) => summarizeSeries(s, bySeries.get(s.id) ?? [], now()) ?? []);
  }

  return {
    async latestCapsule(): Promise<CapsuleSummary | null> {
      const res = await client.capsules.latest.$get(undefined, { init: { signal: AbortSignal.timeout(3000) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/latest responded ${res.status}`);
      const c = await res.json();
      return {
        slug: c.slug,
        title: c.title,
        displayDate: c.displayDate,
        scriptureRef: c.scriptureRef,
        scriptureText: richTextToPlain(c.scriptureText) || null,
      };
    },
    async capsulesInMonth(month) {
      const [rows, series] = await Promise.all([allCapsules({ month }), allSeries()]);
      const titleOf = new Map(series.map((s) => [s.id, s.title]));
      return rows.map((c) => toItem(c, titleOf));
    },
    async listSeries() {
      if (!cached || now().getTime() - cached.at > CACHE_MS) {
        const value = buildSeriesList();
        const entry = { at: now().getTime(), value };
        cached = entry;
        value.catch(() => {
          if (cached === entry) cached = null;
        });
      }
      return cached.value;
    },
    async seriesBySlug(slug) {
      const res = await client.series[":slug"].$get({ param: { slug } } as never, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /series/${slug} responded ${res.status}`);
      const info = await res.json();
      const rows = await allCapsules({ series: slug });
      const items = inSeriesOrder(rows.map((c) => toItem(c, new Map([[info.id, info.title]]))));
      const series = summarizeSeries(info, items, now());
      return series ? { series, capsules: items } : null;
    },
  };
}

/** Serves nothing: null / []. Pages hide the pieces that depend on data. */
export const emptySource: DataSource = {
  latestCapsule: async () => null,
  capsulesInMonth: async () => [],
  listSeries: async () => [],
  seriesBySlug: async () => null,
};

/**
 * Wraps a source so failures never throw. When `fallback` is given, it is used on failure
 * or an empty result; otherwise the result is null / [].
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  const guard = <A extends unknown[], R>(pick: (s: DataSource) => (...a: A) => Promise<R>, empty: R, has: (r: R) => boolean) =>
    async (...args: A): Promise<R> => {
      try {
        const v = await pick(primary)(...args);
        if (has(v)) return v;
      } catch (e) {
        onError?.(e);
      }
      return fallback ? pick(fallback)(...args) : empty;
    };
  const list = (r: unknown[]) => r.length > 0;
  return {
    latestCapsule: guard((s) => () => s.latestCapsule(), null, Boolean),
    capsulesInMonth: guard((s) => (m: string) => s.capsulesInMonth(m), [], list),
    listSeries: guard((s) => () => s.listSeries(), [], list),
    seriesBySlug: guard((s) => (slug: string) => s.seriesBySlug(slug), null, Boolean),
  };
}
