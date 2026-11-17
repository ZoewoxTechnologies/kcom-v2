import type { CapsuleSummary, DataSource, SeriesSummary } from "./types";

type Json = Record<string, unknown>;

/** Plain text of a rich-text document (concatenated text nodes). */
export function richTextToPlain(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Json;
  if (typeof n.text === "string") return n.text;
  const kids = Array.isArray(n.content) ? n.content : [];
  return kids.map(richTextToPlain).join(" ").replace(/\s+/g, " ").trim();
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function toCapsule(raw: Json): CapsuleSummary {
  return {
    slug: String(raw.slug),
    title: String(raw.title),
    displayDate: String(raw.displayDate ?? ""),
    scriptureRef: str(raw.scriptureRef),
    scriptureText: richTextToPlain(raw.scriptureText) || null,
    seriesId: str(raw.seriesId),
  };
}

export function toSeries(raw: Json): SeriesSummary {
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    title: String(raw.title),
    description: str(raw.description),
  };
}

/** Reads the public API. Missing (404) resources are null or empty; other failures throw. */
export function createApiSource(baseUrl: string, fetchImpl: typeof fetch = fetch): DataSource {
  const base = baseUrl.replace(/\/+$/, "");
  async function get(path: string): Promise<unknown | null> {
    const res = await fetchImpl(`${base}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
    return res.json();
  }
  return {
    async latestCapsule() {
      const raw = await get("/capsules/latest");
      return raw ? toCapsule(raw as Json) : null;
    },
    async listSeries() {
      const raw = await get("/series");
      const items = Array.isArray(raw) ? raw : ((raw as Json | null)?.items as unknown[] | undefined);
      return (items ?? []).map((s) => toSeries(s as Json));
    },
  };
}

/** Serves nothing: null / empty lists. Pages hide the pieces that depend on data. */
export const emptySource: DataSource = {
  latestCapsule: async () => null,
  listSeries: async () => [],
};

/**
 * Wraps a source so failures never throw. When `fallback` is given, it is used on failure
 * or empty results; otherwise the result is null / empty.
 */
export function withFallback(primary: DataSource, fallback: DataSource | null, onError?: (e: unknown) => void): DataSource {
  const safe = async <T>(run: (s: DataSource) => Promise<T>, empty: (v: T) => boolean, none: T): Promise<T> => {
    try {
      const v = await run(primary);
      if (!empty(v)) return v;
    } catch (e) {
      onError?.(e);
    }
    return fallback ? run(fallback) : none;
  };
  return {
    latestCapsule: () => safe((s) => s.latestCapsule(), (v) => v === null, null),
    listSeries: () => safe((s) => s.listSeries(), (v) => v.length === 0, []),
  };
}
