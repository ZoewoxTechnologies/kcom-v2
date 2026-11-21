import { siteName } from "./site";
import type { BlogPostSummary, CapsuleListItem, EventSummary, SeriesSummary } from "./data/types";

export const siteDescription =
  "Daily prophetic capsules, teaching and intercession from Kingdom Capstone Outreach Ministries: revelation, restoration, revival.";

/** Pages that exist without any content from the API. */
export const staticPaths = ["/", "/capsules", "/series", "/blog", "/events", "/books", "/about", "/about/team", "/partner", "/contact"] as const;

const trim = (s: string) => s.replace(/\/+$/, "");

/**
 * The public origin: always PUBLIC_SITE_URL in production, and a missing value throws. The request's
 * Host header is only trusted in development, since cached responses must never carry a spoofed origin.
 */
export function siteOrigin(configured: string | undefined, requestOrigin: string, prod = false): string {
  if (configured) return trim(configured);
  if (prod) throw new Error("PUBLIC_SITE_URL is not set. Production needs the site's public origin for canonical and Open Graph URLs.");
  return trim(requestOrigin);
}

/** Absolute URL for a site path. Query strings and fragments are dropped so each page has one canonical. */
export function absoluteUrl(origin: string, path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  return `${trim(origin)}${clean === "/" ? "/" : trim(clean) || "/"}`;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Cut at a word boundary, ending in an ellipsis, so descriptions stay within search-result length. */
export function truncate(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,;:.-]+$/, "")}…`;
}

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

export interface SitemapSources {
  capsules: Pick<CapsuleListItem, "slug" | "displayDate">[];
  series: Pick<SeriesSummary, "slug" | "lastDate">[];
  posts: Pick<BlogPostSummary, "slug" | "date">[];
  events: Pick<EventSummary, "slug" | "startsAt">[];
}

/** Every public URL, de-duplicated and in a stable order. */
export function sitemapEntries(src: SitemapSources): SitemapEntry[] {
  const out: SitemapEntry[] = [
    ...staticPaths.map((path) => ({ path })),
    ...src.capsules.map((c) => ({ path: `/capsules/${c.slug}`, lastmod: c.displayDate })),
    ...src.series.map((s) => ({ path: `/series/${s.slug}`, lastmod: s.lastDate })),
    ...src.posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.date })),
    ...src.events.map((e) => ({ path: `/events/${e.slug}`, lastmod: e.startsAt.slice(0, 10) })),
  ];
  const seen = new Set<string>();
  return out.filter((e) => !seen.has(e.path) && !!seen.add(e.path));
}

export function renderSitemap(origin: string, entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => `  <url><loc>${escapeXml(absoluteUrl(origin, e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(origin, "/sitemap.xml")}\n`;
}

export interface FeedItem {
  title: string;
  path: string;
  /** ISO day (YYYY-MM-DD). */
  date: string;
  description: string;
}

export interface FeedInfo {
  title: string;
  description: string;
  /** Path of the feed itself. */
  selfPath: string;
  /** Path of the HTML page the feed mirrors. */
  homePath: string;
}

/** RFC 822 date at noon UTC for an ISO day, so the day is stable in every timezone. */
export function rfc822(isoDay: string): string {
  return new Date(`${isoDay.slice(0, 10)}T12:00:00Z`).toUTCString();
}

export function renderRss(origin: string, info: FeedInfo, items: FeedItem[]): string {
  const body = items
    .map((i) => {
      const url = escapeXml(absoluteUrl(origin, i.path));
      return `    <item>\n      <title>${escapeXml(i.title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${rfc822(i.date)}</pubDate>\n      <description>${escapeXml(i.description)}</description>\n    </item>`;
    })
    .join("\n");
  const built = items[0] ? rfc822(items[0].date) : new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${escapeXml(info.title)}</title>\n    <link>${escapeXml(absoluteUrl(origin, info.homePath))}</link>\n    <description>${escapeXml(info.description)}</description>\n    <language>en</language>\n    <lastBuildDate>${built}</lastBuildDate>\n    <atom:link href="${escapeXml(absoluteUrl(origin, info.selfPath))}" rel="self" type="application/rss+xml" />\n${body}\n  </channel>\n</rss>\n`;
}

export { siteName };

/** schema.org Article for a capsule page. */
export function capsuleJsonLd(c: { slug: string; title: string; displayDate: string; scriptureRef: string | null }, origin: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    datePublished: c.displayDate,
    image: absoluteUrl(origin, `/og/capsules/${c.slug}.png`),
    mainEntityOfPage: absoluteUrl(origin, `/capsules/${c.slug}`),
    author: { "@type": "Organization", name: siteName },
    publisher: { "@type": "Organization", name: siteName },
    ...(c.scriptureRef ? { about: c.scriptureRef } : {}),
  };
}
