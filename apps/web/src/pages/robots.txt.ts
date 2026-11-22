import { publicOrigin } from "../lib/site-origin";
import type { APIRoute } from "astro";
import { renderRobots } from "../lib/seo";

export const GET: APIRoute = ({ url }) =>
  new Response(renderRobots(publicOrigin(url)), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
