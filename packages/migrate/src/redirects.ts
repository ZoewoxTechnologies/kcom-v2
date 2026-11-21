import { lagosMonth } from "@kcom/content";
import type { Capsule } from "@kcom/content";
import type { BlogRecord } from "./blog.ts";
import type { RawNode } from "./extract.ts";

export interface Redirect {
  /** Old path with the leading slash. */
  from: string;
  to: string;
  /** What kind of old URL this was, for the report. */
  kind: "capsule" | "blog" | "page" | "listing" | "node" | "archive";
}

/** Where each legacy page lives on the new site; any page not listed goes to the home page. */
export const PAGE_TARGETS: Record<string, string> = {
  "welcome-kcom": "/about",
  "who-we-are": "/about",
  "vision-and-mission": "/about",
  "mandate-and-message": "/about",
  "ministry-team": "/about/team",
  "ministry-arms": "/about/team",
  "fire-force": "/about/team",
  salti: "/about/team",
  partnership: "/partner",
};

/** Node types that have no page of their own on the new site, and the listing that replaces each. */
const LISTING_TARGETS: Record<string, string> = {
  events: "/events",
  kcom_books: "/books",
  gallery: "/events",
  simplenews: "/",
};

const path = (alias: string) => `/${alias.replace(/^\/+/, "")}`;

export interface RedirectMap {
  redirects: Redirect[];
  /** Old paths that already are the new path, so they need no redirect. */
  unchanged: string[];
  /** Nodes sent to a listing page because their content is not imported (skipped capsules, events, books, gallery). */
  fallbacks: number;
}

/**
 * The 301 map from every old URL to its new one: each node's aliases and `/node/<nid>`, the monthly
 * archive pages, `/daily-digest` and `/rss.xml`. Imported capsules and posts go to their own page;
 * other nodes go to a page or listing that replaces them.
 */
export function buildRedirects(nodes: RawNode[], capsules: Capsule[], posts: BlogRecord[]): RedirectMap {
  const targetByNid = new Map<number, { to: string; kind: Redirect["kind"] }>();
  for (const c of capsules) if (c.legacyNid !== null) targetByNid.set(c.legacyNid, { to: `/capsules/${c.slug}`, kind: "capsule" });
  for (const p of posts) targetByNid.set(p.legacyNid, { to: `/blog/${p.slug}`, kind: "blog" });

  const byFrom = new Map<string, Redirect>();
  const add = (r: Redirect) => {
    if (!byFrom.has(r.from)) byFrom.set(r.from, r);
  };
  let fallbacks = 0;

  for (const node of [...nodes].sort((a, b) => a.nid - b.nid)) {
    let target = targetByNid.get(node.nid);
    if (!target) {
      if (node.type === "page") target = { to: PAGE_TARGETS[node.aliases[0] ?? ""] ?? "/", kind: "page" };
      else {
        fallbacks++;
        if (node.type === "daily_digest") target = { to: "/capsules", kind: "capsule" };
        else if (node.type === "blog") target = { to: "/blog", kind: "blog" };
        else target = { to: LISTING_TARGETS[node.type] ?? "/", kind: "listing" };
      }
    }
    for (const alias of node.aliases) add({ from: path(alias), to: target.to, kind: target.kind });
    add({ from: `/node/${node.nid}`, to: target.to, kind: "node" });
  }

  const months = new Set(capsules.map((c) => lagosMonth(c.publishAt)));
  for (const m of [...months].sort()) add({ from: `/archive/${m.replace("-", "")}`, to: `/capsules/month/${m}`, kind: "archive" });
  add({ from: "/daily-digest", to: "/capsules", kind: "listing" });

  const unchanged = ["/rss.xml"];
  const redirects = [...byFrom.values()].filter((r) => r.from !== r.to);
  for (const r of byFrom.values()) if (r.from === r.to) unchanged.push(r.from);
  return { redirects, unchanged, fallbacks };
}
