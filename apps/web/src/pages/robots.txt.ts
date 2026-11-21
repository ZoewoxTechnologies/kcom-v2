import type { APIRoute } from "astro";
import { renderRobots, siteOrigin } from "../lib/seo";

export const GET: APIRoute = ({ url }) =>
  new Response(renderRobots(siteOrigin(import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL, url.origin)), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
