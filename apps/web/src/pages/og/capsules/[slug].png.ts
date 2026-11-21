import type { APIRoute } from "astro";
import { data } from "../../../lib/data";
import { renderShareImage } from "../../../lib/share-image";
import { dayParts } from "@kcom/content";

export const GET: APIRoute = async ({ params }) => {
  const capsule = params.slug ? await data.capsuleBySlug(params.slug) : null;
  if (!capsule) return new Response("Not found", { status: 404 });
  const png = await renderShareImage({
    title: capsule.title,
    kicker: capsule.scriptureRef,
    footer: [dayParts(capsule.displayDate).rest, capsule.series?.title].filter(Boolean).join(" · "),
  });
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=0, s-maxage=86400" } });
};
