import { useCallback, useEffect, useState } from "react";
import { lagosMonthRange, slugify } from "@kcom/content";
import { apiJson } from "../api/client";

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

type RichText = Record<string, unknown>;

/** A capsule as the admin API returns it, with every editable field. */
export interface CapsuleRecord extends CapsuleSummary {
  scriptureRef: string | null;
  scriptureText: RichText | null;
  body: RichText;
  decrees: string[];
  prayer: RichText | null;
  bibleMeditation: string | null;
  authorSource: string | null;
  updatedAt: string;
}

/** Fields sent when saving. Rich-text fields are left out when unchanged. */
export interface CapsuleInput {
  title: string;
  slug?: string;
  scriptureRef: string | null;
  scriptureText?: RichText | null;
  body?: RichText;
  decrees: string[];
  prayer?: RichText | null;
  bibleMeditation: string | null;
  authorSource: string | null;
  seriesId: string | null;
  partNumber: number | null;
  status: CapsuleStatus;
  publishAt?: string;
}

const PAGE = 100;

async function listAll<T>(path: string, query = ""): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { items, total } = await apiJson<{ items: T[]; total: number }>(
      `/admin${path}?${query}limit=${PAGE}&offset=${offset}`,
    );
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
/** Capsules whose publish time is in [from, to). */
export function listCapsulesBetween(from: Date, to: Date) {
  const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return listAll<CapsuleSummary>("/capsules", `${q}&`);
}

/** Every draft, whatever its date. */
export const listDrafts = () => listAll<CapsuleSummary>("/capsules", "status=draft&");
export const listSeries = () => listAll<SeriesSummary>("/series");

/** Moves a scheduled capsule to a new go-live instant. */
export async function rescheduleCapsule(id: string, publishAt: Date): Promise<CapsuleSummary> {
  return apiJson<CapsuleSummary>(`/admin/capsules/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "scheduled", publishAt: publishAt.toISOString() }),
  });
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

export const getCapsule = (id: string) => apiJson<CapsuleRecord>(`/admin/capsules/${id}`);

export const createCapsule = (input: CapsuleInput) =>
  apiJson<CapsuleRecord>("/admin/capsules", { method: "POST", body: JSON.stringify(input) });

export const updateCapsule = (id: string, input: Partial<CapsuleInput>) =>
  apiJson<CapsuleRecord>(`/admin/capsules/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const createSeries = (title: string) =>
  apiJson<SeriesSummary>("/admin/series", {
    method: "POST",
    body: JSON.stringify({ title, slug: slugify(title) }),
  });
