import { hc } from "hono/client";
import type { App } from "@kcom/api/app";
import type { CapsuleSummary, DataSource } from "./types";

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "listItem", "bulletList", "orderedList", "codeBlock", "doc"]);

/** Plain text of a rich-text document: inline text joins with no separator, blocks with a space. */
export function richTextToPlain(node: unknown): string {
  const walk = (n: unknown): string => {
    if (!n || typeof n !== "object") return "";
    const o = n as { text?: unknown; content?: unknown; type?: unknown };
    if (typeof o.text === "string") return o.text;
    const kids = Array.isArray(o.content) ? o.content : [];
    const blockKids = kids.some((k) => k && typeof k === "object" && BLOCKS.has((k as { type?: string }).type ?? ""));
    return kids.map(walk).join(blockKids ? " " : "");
  };
  return walk(node).replace(/\s+/g, " ").trim();
}

/**
 * Reads the public API through its own route types, so response shapes cannot drift.
 * A 404 is null; other failures throw. Add sources here as the API grows (e.g. /series).
 */
export function createApiSource(baseUrl: string, fetchImpl: typeof fetch = fetch): DataSource {
  const client = hc<App>(baseUrl.replace(/\/+$/, ""), { fetch: fetchImpl });
  return {
    async latestCapsule(): Promise<CapsuleSummary | null> {
      const res = await client.capsules.latest.$get(undefined, { init: { signal: AbortSignal.timeout(3000) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API /capsules/latest responded ${res.status}`);
      const c = await res.json();
      return {
        slug: c.slug,
        title: c.title,
        displayDate: c.displayDate,
        scriptureRef: c.scriptureRef,
        scriptureText: richTextToPlain(c.scriptureText) || null,
      };
    },
  };
}

const isList = (method: string) => method.startsWith("list");

/**
 * Serves nothing for every method, current and future: an empty array for `list*` methods,
 * null for the rest. Pages hide the pieces that depend on data.
 */
export const emptySource: DataSource = new Proxy({} as DataSource, {
  get: (_t, method) => (typeof method === "string" ? async () => (isList(method) ? [] : null) : undefined),
});

const isEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0);

/**
 * Wraps every method of a source so failures never throw. On failure or an empty result
 * (null or empty list) the same method of `fallback` is used; with no fallback, the empty
 * value comes from `emptySource`. New DataSource methods need no extra code here.
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  const backup = fallback ?? emptySource;
  return new Proxy({} as DataSource, {
    get: (_t, method) => {
      if (typeof method !== "string") return undefined;
      const name = method as keyof DataSource;
      return async (...args: unknown[]) => {
        try {
          const v = await (primary[name] as (...a: unknown[]) => Promise<unknown>)(...args);
          if (!isEmpty(v)) return v;
        } catch (e) {
          onError?.(e);
        }
        return (backup[name] as (...a: unknown[]) => Promise<unknown>)(...args);
      };
    },
  });
}
