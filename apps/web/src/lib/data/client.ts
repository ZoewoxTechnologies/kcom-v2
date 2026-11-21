import { hc } from "hono/client";
import type { App } from "@kcom/api/app";
import { inSeriesOrder, toSeriesSummary } from "./series";
import { dataMethods, type BlogPostSummary, type Capsule, type CapsuleListItem, type CapsuleSummary, type DataSource } from "./types";

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "listItem", "bulletList", "orderedList", "codeBlock", "doc"]);

/** Plain text of a rich-text document: inline text joins with no separator, blocks with a space. */
export function richTextToPlain(node: unknown): string {
  const walk = (n: unknown): string => {
    if (!n || typeof n !== "object") return "";
    const o = n as { text?: unknown; content?: unknown; type?: unknown };
    if (typeof o.text === "string") return o.text;
    const kids = Array.isArray(o.content) ? o.content : [];
    const blockKids = kids.some((k) => k && typeof k === "object" && BLOCKS.has((k as { type?: string }).type ?? ""));
    return kids.map(walk).join(blockKids ? " " : "");
  };
  return walk(node).replace(/\s+/g, " ").trim();
}

/**
 * One rich-text document from a page's sections: each richText section's heading becomes a
 * level-2 heading, followed by its body. Other section kinds are not part of a text page.
 */
export function pageBody(sections: { type: string; props: unknown }[]): Record<string, unknown> {
  const content: unknown[] = [];
  for (const s of sections) {
    if (s.type !== "richText") continue;
    const { heading, body } = s.props as { heading?: string; body?: { content?: unknown[] } };
    if (heading) content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: heading }] });
    content.push(...(body?.content ?? []));
  }
  return { type: "doc", content };
}

type Fetch = typeof fetch;
const PAGE = 100;
const SERIES_TTL_MS = 5000;

const toBlogSummary = (p: { slug: string; title: string; date: string; excerpt: string | null; heroImageUrl: string | null; tags: string[] }): BlogPostSummary => ({
  slug: p.slug,
  title: p.title,
  date: p.date,
  excerpt: p.excerpt,
  heroImageUrl: p.heroImageUrl,
  tags: p.tags,
});

/**
 * Reads the public API through its own route types, so response shapes cannot drift.
 * A 404 is null; other failures throw.
 */
export function createApiSource(baseUrl: string, fetchImpl: Fetch = fetch, now: () => Date = () => new Date()): DataSource {
  const client = hc<App>(baseUrl.replace(/\/+$/, ""), { fetch: fetchImpl });
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
      const res = await client.capsules.$get({ query: { ...query, limit: String(PAGE), offset: String(offset) } }, signal());
      if (!res.ok) throw new Error(`API /capsules responded ${res.status}`);
      const rows = await res.json();
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  /** One /series fetch is shared by calls within a few seconds (a page asks for it more than once). */
  let seriesCache: { at: number; rows: ReturnType<typeof fetchSeries> } | null = null;
  async function fetchSeries() {
    const res = await client.series.$get(undefined, signal());
    if (!res.ok) throw new Error(`API /series responded ${res.status}`);
    return res.json();
  }
  function allSeries() {
    const t = now().getTime();
    if (!seriesCache || t - seriesCache.at > SERIES_TTL_MS) {
      const rows = fetchSeries();
      seriesCache = { at: t, rows };
      rows.catch(() => { if (seriesCache?.rows === rows) seriesCache = null; });
    }
    return seriesCache.rows;
  }

  type Full = Awaited<ReturnType<Awaited<ReturnType<(typeof client.capsules)[":slug"]["$get"]>>["json"]>>;
  async function toCapsule(c: Full): Promise<Capsule> {
    const series = c.seriesId ? (await allSeries()).find((s) => s.id === c.seriesId) : undefined;
    return {
      slug: c.slug,
      title: c.title,
      displayDate: c.displayDate,
      scriptureRef: c.scriptureRef,
      scriptureText: c.scriptureText,
      bibleMeditation: c.bibleMeditation,
      body: c.body,
      decrees: c.decrees,
      prayer: c.prayer,
      authorSource: c.authorSource,
      series: series ? { slug: series.slug, title: series.title } : null,
      partNumber: c.partNumber,
      // The API has no banner field yet; the page hides the banner when it is null.
      bannerUrl: null,
    };
  }

  return {
    async capsuleBySlug(slug) {
      const res = await client.capsules[":slug"].$get({ param: { slug } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/${slug} responded ${res.status}`);
      return toCapsule(await res.json());
    },
    async capsuleByDate(date) {
      const res = await client.capsules.date[":date"].$get({ param: { date } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/date/${date} responded ${res.status}`);
      return toCapsule(await res.json());
    },
    async capsuleNeighbours(slug) {
      const res = await client.capsules[":slug"].neighbours.$get({ param: { slug } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/${slug}/neighbours responded ${res.status}`);
      return res.json();
    },
    async latestCapsule(): Promise<CapsuleSummary | null> {
      const res = await client.capsules.latest.$get(undefined, { init: { signal: AbortSignal.timeout(3000) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/latest responded ${res.status}`);
      const c = await res.json();
      // The verse bar renders this on every page: a malformed body must read as no capsule, never as "Invalid Date".
      if (!c || typeof c.slug !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.displayDate))) return null;
      return {
        slug: c.slug,
        title: c.title,
        displayDate: c.displayDate,
        scriptureRef: c.scriptureRef,
        scriptureText: richTextToPlain(c.scriptureText) || null,
      };
    },
    async listCapsulesInMonth(month) {
      const [rows, series] = await Promise.all([allCapsules({ month }), allSeries()]);
      const titleOf = new Map(series.map((s) => [s.id, s.title]));
      return rows.map((c) => toItem(c, titleOf));
    },
    async listAllCapsules() {
      const [rows, series] = await Promise.all([allCapsules({}), allSeries()]);
      const titleOf = new Map(series.map((s) => [s.id, s.title]));
      return rows.map((c) => toItem(c, titleOf)).sort((a, b) => b.displayDate.localeCompare(a.displayDate));
    },
    async listSeries() {
      return (await allSeries()).map((s) => toSeriesSummary(s, now()));
    },
    async seriesBySlug(slug) {
      const res = await client.series[":slug"].$get({ param: { slug } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /series/${slug} responded ${res.status}`);
      const info = await res.json();
      const rows = await allCapsules({ series: slug });
      return {
        series: toSeriesSummary(info, now()),
        capsules: inSeriesOrder(rows.map((c) => toItem(c, new Map([[info.id, info.title]])))),
      };
    },
    async listBlogPosts({ limit = 20, offset = 0 } = {}) {
      const res = await client.blog.$get({ query: { limit: String(limit), offset: String(offset) } }, signal());
      if (!res.ok) throw new Error(`API /blog responded ${res.status}`);
      return (await res.json()).map(toBlogSummary);
    },
    async blogPostBySlug(slug) {
      const res = await client.blog[":slug"].$get({ param: { slug } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /blog/${slug} responded ${res.status}`);
      const p = await res.json();
      return { ...toBlogSummary(p), body: p.body };
    },
    async listRedirects() {
      const res = await client.redirects.$get(undefined, signal());
      if (!res.ok) throw new Error(`API /redirects responded ${res.status}`);
      return res.json();
    },
    async listHomepageSections() {
      const res = await client.homepage.$get(undefined, signal());
      if (!res.ok) throw new Error(`API /homepage responded ${res.status}`);
      return (await res.json()).sections.map((s) => s.key);
    },
    async listBooks() {
      const res = await client.books.$get({ query: { limit: "100", offset: "0" } }, signal());
      if (!res.ok) throw new Error(`API /books responded ${res.status}`);
      return (await res.json()).map((b) => ({
        slug: b.slug,
        title: b.title,
        description: richTextToPlain(b.description) || null,
        coverUrl: b.coverUrl,
        purchaseUrl: b.purchaseUrl,
        publishedYear: b.publishedYear,
        kind: null,
        author: null,
        sampleUrl: null,
      }));
    },
    async listEvents(when) {
      const res = await client.events.$get({ query: { when, limit: "100", offset: "0" } }, signal());
      if (!res.ok) throw new Error(`API /events responded ${res.status}`);
      return (await res.json()).map((e) => ({
        slug: e.slug,
        title: e.title,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        allDay: e.allDay,
        place: e.place,
        summary: richTextToPlain(e.description) || null,
        online: e.onlineUrl !== null,
      }));
    },
    async pageBySlug(slug) {
      const res = await client.pages[":slug"].$get({ param: { slug } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /pages/${slug} responded ${res.status}`);
      const p = await res.json();
      return { slug: p.slug, title: p.title, body: pageBody(p.sections) };
    },
    async eventBySlug(slug) {
      const res = await client.events[":slug"].$get({ param: { slug } }, signal());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /events/${slug} responded ${res.status}`);
      const e = await res.json();
      return {
        slug: e.slug,
        title: e.title,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        allDay: e.allDay,
        place: e.place,
        description: e.description,
        imageUrl: e.imageUrl,
        onlineUrl: e.onlineUrl,
        programme: e.programme,
        relatedPost: e.relatedPost,
      };
    },
  };
}

type Fn = (...args: unknown[]) => Promise<unknown>;
const isList = (method: string) => method.startsWith("list");
const isEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0);

function build(make: (method: (typeof dataMethods)[number]) => Fn): DataSource {
  return Object.fromEntries(dataMethods.map((m) => [m, make(m)])) as unknown as DataSource;
}

/**
 * Serves nothing for every method: an empty array for `list*` methods, null for the rest.
 * Pages hide the pieces that depend on data.
 */
export const emptySource: DataSource = build((m) => async () => (isList(m) ? [] : null));

/**
 * Wraps every method of a source so failures never throw. On failure or an empty result
 * (null or empty list) the same method of `fallback` is used; with no fallback, the empty
 * value from `emptySource`.
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  const backup = fallback ?? emptySource;
  return build((m) => async (...args) => {
    try {
      const v = await (primary[m] as Fn)(...args);
      if (!isEmpty(v)) return v;
    } catch (e) {
      onError?.(e);
    }
    return (backup[m] as Fn)(...args);
  });
}
