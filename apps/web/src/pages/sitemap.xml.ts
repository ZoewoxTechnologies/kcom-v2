import { publicOrigin } from "../lib/site-origin";
import type { APIRoute } from "astro";
import { data } from "../lib/data";
import { allBlogPosts } from "../lib/blog";
import { renderSitemap, sitemapEntries } from "../lib/seo";

export const GET: APIRoute = async ({ url }) => {
  const [capsules, series, posts, upcoming, past] = await Promise.all([data.listAllCapsules(), data.listSeries(), allBlogPosts(data), data.listEvents("upcoming"), data.listEvents("past")]);
  const origin = publicOrigin(url);
  const xml = renderSitemap(origin, sitemapEntries({ capsules, series, posts, events: [...upcoming, ...past] }));
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600" } });
};
