import { hc } from "hono/client";
import type { App } from "@kcom/api/app";
import type { Capsule, CapsuleLink, CapsuleSummary, DataSource, RichTextDoc } from "./types";

/** Plain text of a rich-text document (concatenated text nodes). */
export function richTextToPlain(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text;
  const kids = Array.isArray(n.content) ? n.content : [];
  return kids.map(richTextToPlain).join(" ").replace(/\s+/g, " ").trim();
}

const SIGNAL = () => ({ init: { signal: AbortSignal.timeout(3000) } });

const toLink = (c: { slug: string; title: string; displayDate: string; scriptureRef: string | null; seriesId: string | null; partNumber: number | null }): CapsuleLink => ({
  slug: c.slug,
  title: c.title,
  displayDate: c.displayDate,
  scriptureRef: c.scriptureRef,
  seriesId: c.seriesId,
  partNumber: c.partNumber,
});

const toCapsule = (c: {
  slug: string;
  title: string;
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: RichTextDoc | null;
  bibleMeditation: string | null;
  body: RichTextDoc;
  decrees: string[];
  prayer: RichTextDoc | null;
  authorSource: string | null;
  seriesId: string | null;
  partNumber: number | null;
}): Capsule => ({
  ...toLink(c),
  scriptureText: c.scriptureText,
  bibleMeditation: c.bibleMeditation,
  body: c.body,
  decrees: c.decrees,
  prayer: c.prayer,
  authorSource: c.authorSource,
  // The API has no banner field yet; the page hides the banner when it is null.
  bannerUrl: null,
});

/**
 * Reads the public API through its own route types, so response shapes cannot drift.
 * A 404 is null; other failures throw.
 */
export function createApiSource(baseUrl: string, fetchImpl: typeof fetch = fetch): DataSource {
  const client = hc<App>(baseUrl.replace(/\/+$/, ""), { fetch: fetchImpl });
  return {
    async latestCapsule(): Promise<CapsuleSummary | null> {
      const res = await client.capsules.latest.$get(undefined, SIGNAL());
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
    async capsuleBySlug(slug) {
      const res = await client.capsules[":slug"].$get({ param: { slug } }, SIGNAL());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/${slug} responded ${res.status}`);
      return toCapsule(await res.json());
    },
    async capsuleByDate(date) {
      const res = await client.capsules.date[":date"].$get({ param: { date } }, SIGNAL());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/date/${date} responded ${res.status}`);
      return toCapsule(await res.json());
    },
    async listCapsules({ month, date, series, limit = 100 }) {
      const query: { limit: string; offset: string; month?: string; date?: string; series?: string } = { limit: String(limit), offset: "0" };
      if (month) query.month = month;
      if (date) query.date = date;
      if (series) query.series = series;
      const res = await client.capsules.$get({ query }, SIGNAL());
      if (!res.ok) throw new Error(`API /capsules responded ${res.status}`);
      return (await res.json()).map(toLink);
    },
    async listSeries() {
      const res = await client.series.$get(undefined, SIGNAL());
      if (!res.ok) throw new Error(`API /series responded ${res.status}`);
      return (await res.json()).map((s) => ({ id: s.id, slug: s.slug, title: s.title }));
    },
  };
}

/** Serves nothing: null / []. Pages hide the pieces that depend on data. */
export const emptySource: DataSource = {
  latestCapsule: async () => null,
  capsuleBySlug: async () => null,
  capsuleByDate: async () => null,
  listCapsules: async () => [],
  listSeries: async () => [],
};

/**
 * Wraps a source so failures never throw. When `fallback` is given, it is used on failure
 * or an empty result; otherwise the result is null.
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  const guard = <A extends unknown[], R>(call: (s: DataSource) => (...a: A) => Promise<R>, empty: R) =>
    async (...args: A): Promise<R> => {
      try {
        const v = await call(primary)(...args);
        if (v !== null && !(Array.isArray(v) && v.length === 0)) return v;
      } catch (e) {
        onError?.(e);
      }
      return fallback ? call(fallback)(...args) : empty;
    };
  return {
    latestCapsule: guard((s) => s.latestCapsule.bind(s), null),
    capsuleBySlug: guard((s) => s.capsuleBySlug.bind(s), null),
    capsuleByDate: guard((s) => s.capsuleByDate.bind(s), null),
    listCapsules: guard((s) => s.listCapsules.bind(s), []),
    listSeries: guard((s) => s.listSeries.bind(s), []),
  };
}
