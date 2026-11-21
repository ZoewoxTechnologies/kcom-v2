import { defineMiddleware } from "astro:middleware";
import { data } from "./lib/data";
import { createRedirectLookup } from "./lib/redirects";
import { assertSiteUrl } from "./lib/site-origin";

assertSiteUrl();

const redirects = createRedirectLookup(() => data.listRedirects());

/**
 * Old-site URLs answer with a permanent redirect to their new path. The map is only consulted
 * when the site has no page for the path, so live pages pay nothing.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (response.status !== 404 || (context.request.method !== "GET" && context.request.method !== "HEAD")) return response;
  const hit = await redirects.find(context.url.pathname);
  if (!hit) return response;
  return context.redirect(hit.to + context.url.search, hit.status as 301 | 302 | 307 | 308);
});
