import { publicOrigin } from "../../lib/site-origin";
import type { APIRoute } from "astro";
import { data } from "../../lib/data";
import { renderRss, truncate } from "../../lib/seo";
import { siteName } from "../../lib/site";

export const GET: APIRoute = async ({ url }) => {
  const posts = await data.listBlogPosts({ limit: 30 });
  const items = posts.map((p) => ({ title: p.title, path: `/blog/${p.slug}`, date: p.date, description: truncate(p.excerpt ?? p.title, 300) }));
  const origin = publicOrigin(url);
  const xml = renderRss(origin, { title: `${siteName}: blog`, description: "Posts from the ministry.", selfPath: "/blog/rss.xml", homePath: "/blog" }, items);
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900" } });
};
