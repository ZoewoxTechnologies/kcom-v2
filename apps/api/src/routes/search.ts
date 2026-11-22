import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CapsuleDb } from "@kcom/db";
import { DEFAULT_TRUSTED_PROXY_HOPS, requestClientIp } from "../client-ip.js";
import { overLimit, type RateLimit } from "../rate-limit.js";
import { aboutPages } from "../search-pages.js";
import { validate } from "../validate.js";

export const SEARCH_LIMIT = 50;
export const SEARCH_RATE_LIMIT: RateLimit = { max: 60, windowMs: 60 * 1000 };

const query = z.object({ q: z.string().trim().min(1).max(100) });

// ts_headline marks matches with these private-use characters, which are stripped from the source
// text first. The response carries plain-text segments, so the page never has to trust markup.
const START = 0xe000;
const STOP = 0xe001;

export type Segment = { text: string; match: boolean };

export function segments(headline: string): Segment[] {
  const out: Segment[] = [];
  let match = false;
  for (const part of headline.split(new RegExp(`([${String.fromCharCode(START, STOP)}])`))) {
    if (part === String.fromCharCode(START)) match = true;
    else if (part === String.fromCharCode(STOP)) match = false;
    else if (part) out.push({ text: part, match });
  }
  return out;
}

type Row = {
  type: string;
  url: string;
  title: string;
  date: string | null;
  series: string | null;
  excerpt: string;
};

const live = (alias: string) =>
  sql.raw(
    `${alias}.status = 'published' and (${alias}.publish_at is null or ${alias}.publish_at <= now())`,
  );

/**
 * Public site search: published content only, ranked by Postgres full-text search (titles first),
 * at most SEARCH_LIMIT hits. Each source matches on the same tsvector function the GIN indexes use.
 */
export function searchRoutes(db: CapsuleDb, trustedProxyHops = DEFAULT_TRUSTED_PROXY_HOPS) {
  return new Hono().get("/", validate("query", query), async (c) => {
    const { q } = c.req.valid("query");
    const ip = requestClientIp(c, trustedProxyHops);
    if (ip && (await overLimit(db, `search:${ip}`, SEARCH_RATE_LIMIT))) {
      c.header("Retry-After", String(SEARCH_RATE_LIMIT.windowMs / 1000));
      return c.json(
        { error: { code: "rate_limited", message: "Too many searches. Please wait a moment." } },
        429,
      );
    }
    const pages = sql.join(
      aboutPages.map((p) => sql`(${p.url}::text, ${p.title}::text, ${p.content}::text)`),
      sql`, `,
    );
    const result = await db.execute(sql`
      with q as (select websearch_to_tsquery('english', ${q}) as tsq),
      docs as (
        select 'Capsule' as type, '/capsules/' || c.slug as url, c.title,
          to_char(c.publish_at at time zone 'Africa/Lagos', 'YYYY-MM-DD') as date, s.title as series,
          concat_ws(' ', c.scripture_ref, c.bible_meditation, kcom_rich_text(c.body),
            kcom_rich_text(c.scripture_text), kcom_rich_text(c.prayer), kcom_join_text(c.decrees)) as body,
          kcom_capsule_tsv(c.title, c.scripture_ref, c.bible_meditation, c.body, c.scripture_text, c.prayer, c.decrees) as tsv
        from capsules c left join series s on s.id = c.series_id
        where ${live("c")}
          and kcom_capsule_tsv(c.title, c.scripture_ref, c.bible_meditation, c.body, c.scripture_text, c.prayer, c.decrees) @@ (select tsq from q)
        union all
        select 'Blog', '/blog/' || b.slug, b.title, b.date::text, null,
          concat_ws(' ', b.excerpt, kcom_join_text(b.tags), kcom_rich_text(b.body)),
          kcom_blog_tsv(b.title, b.excerpt, b.tags, b.body)
        from blog_posts b
        where ${live("b")} and kcom_blog_tsv(b.title, b.excerpt, b.tags, b.body) @@ (select tsq from q)
        union all
        select 'Event', '/events/' || e.slug, e.title,
          to_char(e.starts_at at time zone 'Africa/Lagos', 'YYYY-MM-DD'), null,
          concat_ws(' ', e.place, kcom_rich_text(e.description), e.programme),
          kcom_event_tsv(e.title, e.place, e.description, e.programme)
        from events e
        where e.status = 'published' and kcom_event_tsv(e.title, e.place, e.description, e.programme) @@ (select tsq from q)
        union all
        select 'Book', '/books', k.title, k.published_year::text, null,
          kcom_rich_text(k.description), kcom_book_tsv(k.title, k.description)
        from books k
        where ${live("k")} and kcom_book_tsv(k.title, k.description) @@ (select tsq from q)
        union all
        select 'Series', '/series/' || r.slug, r.title, null, r.title,
          coalesce(r.description, ''), kcom_series_tsv(r.title, r.description)
        from series r
        where exists (select 1 from capsules c where c.series_id = r.id and ${live("c")})
          and kcom_series_tsv(r.title, r.description) @@ (select tsq from q)
        union all
        select 'Page', p.url, p.title, 'About', null, p.content,
          setweight(to_tsvector('english', p.title), 'A') || setweight(to_tsvector('english', p.content), 'C')
        from (values ${pages}) as p(url, title, content)
        where setweight(to_tsvector('english', p.title), 'A') || setweight(to_tsvector('english', p.content), 'C') @@ (select tsq from q)
      ),
      ranked as (
        select docs.*, ts_rank_cd(docs.tsv, q.tsq) as rank
        from docs, q
        order by rank desc, docs.date desc nulls last, docs.title
        limit ${SEARCH_LIMIT}
      )
      select ranked.type, ranked.url, ranked.title, ranked.date, ranked.series,
        ts_headline('english', translate(left(ranked.body, 20000), ${String.fromCharCode(START, STOP)}, ''), q.tsq,
          ${`MaxWords=24, MinWords=12, MaxFragments=1, StartSel=${String.fromCharCode(START)}, StopSel=${String.fromCharCode(STOP)}`}) as excerpt
      from ranked, q
      order by ranked.rank desc, ranked.date desc nulls last, ranked.title
    `);
    const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Row[];
    c.header("Cache-Control", "public, max-age=30");
    return c.json({
      query: q,
      hits: rows.map((r) => ({
        type: r.type,
        url: r.url,
        title: r.title,
        date: r.date,
        series: r.series,
        excerpt: segments(r.excerpt),
      })),
    });
  });
}
