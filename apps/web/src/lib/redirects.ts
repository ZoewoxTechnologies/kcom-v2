import type { RedirectRule } from "./data/types";

/** Old-site paths to their new paths. Keys are normalised paths, see `normalisePath`. */
export type RedirectMap = Map<string, { to: string; status: number }>;

/** Percent-decoded where valid, so `/content/god%E2%80%99s-word` finds the key `/content/god’s-word`. */
function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Decoded, NFC, lowercase, no trailing slash (except the root), no query string: how old paths are keyed. */
export function normalisePath(pathname: string): string {
  const p = decodePath(pathname).normalize("NFC").toLowerCase().replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/** Only a path on this site: one slash, then not another slash or a backslash (browsers read `//` and `/\` as another host). */
export const isSameSitePath = (to: string) => /^\/(?![/\\])/.test(to);

const MAX_HOPS = 10;

/**
 * Builds the lookup. Rules whose target is not a same-site path are dropped, so a bad row can never
 * send readers to another site. Chains (a to b, b to c) collapse to one hop (a to c); a loop drops its rules.
 */
export function buildMap(rules: RedirectRule[]): RedirectMap {
  const map: RedirectMap = new Map();
  for (const r of rules) {
    const key = normalisePath(r.from);
    if (isSameSitePath(r.to) && !map.has(key)) map.set(key, { to: r.to, status: r.status });
  }
  // Resolve against the original targets, so a loop drops every rule in it, not just the first.
  const original = new Map([...map].map(([k, v]) => [k, v.to]));
  for (const [key, rule] of [...map]) {
    let to = rule.to;
    let hops = 0;
    for (
      let next = original.get(normalisePath(to));
      next !== undefined && hops <= MAX_HOPS;
      next = original.get(normalisePath(to)), hops++
    )
      to = next;
    if (hops > MAX_HOPS || normalisePath(to) === key) map.delete(key);
    else rule.to = to;
  }
  return map;
}

/** Legacy prefixes that never match a live page, so their redirect is checked before rendering a 404. */
export const LEGACY_PREFIXES = ["/node/", "/content/", "/archive/"];
export const isLegacyPath = (pathname: string) =>
  LEGACY_PREFIXES.some((p) => pathname.toLowerCase().startsWith(p));

export interface RedirectLookup {
  find(pathname: string): Promise<{ to: string; status: number } | null>;
}

/**
 * Looks old paths up in a map kept in memory. The map is loaded on first use and then at most once
 * per `ttlMs`; a failed or empty load keeps the previous map (or an empty one) and retries after
 * `retryMs`, so a down API never slows every request.
 */
export function createRedirectLookup(
  load: () => Promise<RedirectRule[]>,
  {
    ttlMs = 5 * 60_000,
    retryMs = 30_000,
    now = Date.now,
  }: { ttlMs?: number; retryMs?: number; now?: () => number } = {},
): RedirectLookup {
  let map: RedirectMap = new Map();
  let expires = 0;
  let loading: Promise<void> | null = null;

  const refresh = () =>
    (loading ??= load()
      .then((rules) => {
        if (rules.length > 0) {
          map = buildMap(rules);
          expires = now() + ttlMs;
        } else expires = now() + retryMs;
      })
      .catch(() => {
        expires = now() + retryMs;
      })
      .finally(() => {
        loading = null;
      }));

  return {
    async find(pathname) {
      if (now() >= expires) await refresh();
      return map.get(normalisePath(pathname)) ?? null;
    },
  };
}
