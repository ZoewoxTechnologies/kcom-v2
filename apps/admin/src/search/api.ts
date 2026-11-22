import { apiJson } from "../api/client";

export type SearchKind = "capsule" | "blog" | "event";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  status: "draft" | "scheduled" | "published";
}

export const searchContent = async (q: string, signal?: AbortSignal) =>
  (
    await apiJson<{ items: SearchResult[] }>(`/admin/search?q=${encodeURIComponent(q)}`, {
      signal,
    })
  ).items;

export const kindLabel: Record<SearchKind, string> = {
  capsule: "Capsule",
  blog: "Blog",
  event: "Event",
};

/** The admin route that opens this result's editor. */
export const resultPath = ({ kind, id }: SearchResult) =>
  kind === "capsule" ? `/capsules/${id}` : kind === "blog" ? `/blog/${id}` : `/events?open=${id}`;
