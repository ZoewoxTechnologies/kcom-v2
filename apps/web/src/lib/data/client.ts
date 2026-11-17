import { hc } from "hono/client";
import type { App } from "@kcom/api/app";
import type { CapsuleSummary, DataSource } from "./types";

/** Plain text of a rich-text document (concatenated text nodes). */
export function richTextToPlain(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text;
  const kids = Array.isArray(n.content) ? n.content : [];
  return kids.map(richTextToPlain).join(" ").replace(/\s+/g, " ").trim();
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

/** Serves nothing: null. Pages hide the pieces that depend on data. */
export const emptySource: DataSource = {
  latestCapsule: async () => null,
};

/**
 * Wraps a source so failures never throw. When `fallback` is given, it is used on failure
 * or an empty result; otherwise the result is null.
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  return {
    async latestCapsule() {
      try {
        const v = await primary.latestCapsule();
        if (v) return v;
      } catch (e) {
        onError?.(e);
      }
      return fallback ? fallback.latestCapsule() : null;
    },
  };
}
