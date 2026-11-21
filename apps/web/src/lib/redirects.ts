import type { RedirectRule } from "./data/types";

/** Old-site paths to their new paths. Keys are normalised paths, see `normalisePath`. */
export type RedirectMap = Map<string, { to: string; status: number }>;

/** Lowercase, no trailing slash (except the root), no query string: how old paths are keyed. */
export function normalisePath(pathname: string): string {
  const p = pathname.toLowerCase().replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

export function buildMap(rules: RedirectRule[]): RedirectMap {
  const map: RedirectMap = new Map();
  for (const r of rules) {
    const key = normalisePath(r.from);
    if (!map.has(key)) map.set(key, { to: r.to, status: r.status });
  }
  return map;
}

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
  { ttlMs = 5 * 60_000, retryMs = 30_000, now = Date.now }: { ttlMs?: number; retryMs?: number; now?: () => number } = {},
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
