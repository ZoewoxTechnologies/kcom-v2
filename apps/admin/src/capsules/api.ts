import { useCallback, useEffect, useState } from "react";
import { lagosMonthRange } from "@kcom/content";

export type CapsuleStatus = "draft" | "scheduled" | "published";

export interface CapsuleSummary {
  id: string;
  title: string;
  slug: string;
  status: CapsuleStatus;
  seriesId: string | null;
  partNumber: number | null;
  publishAt: string;
}

export interface SeriesSummary {
  id: string;
  title: string;
}

const baseUrl = () => (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PAGE = 100;

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl()}/admin${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`request failed (${res.status})`);
  return res;
}

async function listAll<T>(path: string, query = ""): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await call(`${path}?${query}limit=${PAGE}&offset=${offset}`);
    const { items, total } = (await res.json()) as { items: T[]; total: number };
    out.push(...items);
    if (out.length >= total || items.length === 0) return out;
  }
}

/**
 * Capsules, optionally only those whose Lagos day falls in `month` (YYYY-MM).
 * The list page still loads everything and filters in the browser; server-side
 * search and series filters are a follow-up.
 */
export function listCapsules(month?: string) {
  if (!month) return listAll<CapsuleSummary>("/capsules");
  const [from, to] = lagosMonthRange(month);
  const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return listAll<CapsuleSummary>("/capsules", `${q}&`);
}
export const listSeries = () => listAll<SeriesSummary>("/series");

/** Moves a scheduled capsule to a new go-live instant. */
export async function rescheduleCapsule(id: string, publishAt: Date): Promise<CapsuleSummary> {
  const res = await call(`/capsules/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "scheduled", publishAt: publishAt.toISOString() }),
  });
  return (await res.json()) as CapsuleSummary;
}

/** Series plus capsules (all, or one Lagos month); `replace` swaps in an updated capsule. */
export function useCapsules(month?: string) {
  const [capsules, setCapsules] = useState<CapsuleSummary[]>([]);
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    setState("loading");
    Promise.all([listCapsules(month), listSeries()]).then(
      ([c, s]) => {
        setCapsules(c);
        setSeries(s);
        setState("ready");
      },
      () => setState("error"),
    );
  }, [month]);
  useEffect(load, [load]);

  const replace = (next: CapsuleSummary) =>
    setCapsules((all) => all.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  return { capsules, series, state, reload: load, replace };
}

/** Route to a capsule's editor (built separately). */
export const capsuleEditPath = (id: string) => `/capsules/${id}`;
