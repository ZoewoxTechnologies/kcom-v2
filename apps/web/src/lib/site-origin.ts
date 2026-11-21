import { siteOrigin } from "./seo";

const configured = () => import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL;

/** The site's public origin for a request; throws in production when PUBLIC_SITE_URL is unset. */
export const publicOrigin = (url: URL): string => siteOrigin(configured(), url.origin, import.meta.env.PROD);

/** Fails the server at start-up (rather than on the first page) when production has no PUBLIC_SITE_URL. */
export function assertSiteUrl(): void {
  if (import.meta.env.PROD) siteOrigin(configured(), "", true);
}
