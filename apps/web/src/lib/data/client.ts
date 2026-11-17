import { hc } from "hono/client";
import type { App } from "@kcom/api/app";
import { dataMethods, type CapsuleSummary, type DataSource } from "./types";

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

type Fn = (...args: unknown[]) => Promise<unknown>;
const isList = (method: string) => method.startsWith("list");
const isEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0);

function build(make: (method: (typeof dataMethods)[number]) => Fn): DataSource {
  return Object.fromEntries(dataMethods.map((m) => [m, make(m)])) as unknown as DataSource;
}

/**
 * Serves nothing for every method: an empty array for `list*` methods, null for the rest.
 * Pages hide the pieces that depend on data.
 */
export const emptySource: DataSource = build((m) => async () => (isList(m) ? [] : null));

/**
 * Wraps every method of a source so failures never throw. On failure or an empty result
 * (null or empty list) the same method of `fallback` is used; with no fallback, the empty
 * value from `emptySource`.
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  const backup = fallback ?? emptySource;
  return build((m) => async (...args) => {
    try {
      const v = await (primary[m] as Fn)(...args);
      if (!isEmpty(v)) return v;
    } catch (e) {
      onError?.(e);
    }
    return (backup[m] as Fn)(...args);
  });
}
