/**
 * Builds the Pagefind index into dist/client/pagefind after `astro build`.
 * Reads the public API at PUBLIC_API_URL; without it (CI, Docker builds) only the About pages
 * are indexed. Published content is only searchable after the next build and deploy.
 */
import { createIndex } from "pagefind";
import { aboutRecords, blogRecord, bookRecord, capsuleRecord, eventRecord, seriesRecord, type SearchRecord } from "../src/lib/search-index.ts";

const base = process.env.PUBLIC_API_URL?.replace(/\/+$/, "");
const PAGE = 100;

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function all(path: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let offset = 0; ; offset += PAGE) {
    const rows = (await getJson(`${path}${sep}limit=${PAGE}&offset=${offset}`)) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function records(): Promise<SearchRecord[]> {
  const out = [...aboutRecords];
  if (!base) {
    console.warn("[search] PUBLIC_API_URL not set: indexing About pages only");
    return out;
  }
  const [series, capsules, posts, events, past, books] = await Promise.all([all("/series"), all("/capsules"), all("/blog"), all("/events?when=upcoming"), all("/events?when=past"), all("/books")]);
  const titleOf = new Map(series.map((s) => [String(s.id), String(s.title)]));
  out.push(...series.map(seriesRecord));
  out.push(...capsules.map((c) => capsuleRecord(c, c.seriesId ? (titleOf.get(String(c.seriesId)) ?? null) : null)));
  out.push(...posts.map(blogRecord), ...[...events, ...past].map(eventRecord), ...books.map(bookRecord));
  return out;
}

const { index, errors } = await createIndex({});
if (!index) throw new Error(`pagefind: ${errors.join("; ")}`);
const recs = await records();
for (const r of recs) {
  const { errors: e } = await index.addCustomRecord({ url: r.url, content: r.content, language: "en", meta: { title: r.title, ...r.meta }, filters: r.filters });
  if (e.length) throw new Error(`pagefind ${r.url}: ${e.join("; ")}`);
}
const { errors: werr } = await index.writeFiles({ outputPath: "dist/client/pagefind" });
if (werr.length) throw new Error(`pagefind write: ${werr.join("; ")}`);
await index.deleteIndex();
console.log(`[search] indexed ${recs.length} pages`);
