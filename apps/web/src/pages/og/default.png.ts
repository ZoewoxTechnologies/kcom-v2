import type { APIRoute } from "astro";
import { renderShareImage } from "../../lib/share-image";

export const GET: APIRoute = async () =>
  new Response(await renderShareImage({ title: "Revelation, Restoration, Revival", footer: "Daily prophetic capsules, teaching and intercession" }), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
