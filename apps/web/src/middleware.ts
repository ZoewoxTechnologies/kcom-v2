import { defineMiddleware } from "astro:middleware";
import { data } from "./lib/data";
import { createRedirectLookup, isLegacyPath } from "./lib/redirects";
import { assertSiteUrl } from "./lib/site-origin";

assertSiteUrl();

const redirects = createRedirectLookup(() => data.listRedirects());

/**
 * Old-site URLs answer with a permanent redirect to their new path. Legacy prefixes are checked
 * before the page is rendered; every other path is checked only after the site answers 404, so
 * live pages pay nothing.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") return next();
  const go = async () => {
    const hit = await redirects.find(context.url.pathname);
    return hit ? context.redirect(hit.to + context.url.search, hit.status as 301 | 302 | 307 | 308) : null;
  };
  if (isLegacyPath(context.url.pathname)) {
    const early = await go();
    if (early) return early;
  }
  const response = await next();
  return response.status === 404 && !isLegacyPath(context.url.pathname) ? ((await go()) ?? response) : response;
});
