import { defineMiddleware } from "astro:middleware";
import { assertSiteUrl } from "./lib/site-origin";

assertSiteUrl();

export const onRequest = defineMiddleware((_context, next) => next());
