import type { APIRoute } from "astro";
import { data } from "../lib/data";
import { richTextToPlain } from "../lib/data/client";
import { renderRss, siteOrigin, truncate, type FeedItem } from "../lib/seo";
import { siteName } from "../lib/site";

const FEED_SIZE = 30;

export const GET: APIRoute = async ({ url }) => {
  const latest = (await data.listAllCapsules()).slice(0, FEED_SIZE);
  const full = await Promise.all(latest.map((c) => data.capsuleBySlug(c.slug)));
  const items: FeedItem[] = latest.map((c, i) => ({
    title: c.title,
    path: `/capsules/${c.slug}`,
    date: c.displayDate,
    description: truncate([c.scriptureRef, richTextToPlain(full[i]?.scriptureText)].filter(Boolean).join(" — ") || c.title, 300),
  }));
  const origin = siteOrigin(import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL, url.origin);
  const xml = renderRss(origin, { title: `${siteName}: daily capsules`, description: "A new prophetic capsule every day.", selfPath: "/rss.xml", homePath: "/capsules" }, items);
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900" } });
};
