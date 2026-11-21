import { apiFetch, apiJson } from "../api/client";

export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";
export type SubscriberSortKey = "name" | "email" | "status" | "joined";

export interface SubscriberRecord {
  id: string;
  name: string | null;
  email: string;
  status: SubscriberStatus;
  subscribedAt: string;
}

export interface SubscriberFilters {
  q: string;
  status: SubscriberStatus | "";
}

export interface SubscriberPage {
  items: SubscriberRecord[];
  total: number;
  counts: Record<SubscriberStatus, number>;
}

export const PAGE_SIZE = 25;

const filterParams = ({ q, status }: SubscriberFilters) => {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  return params;
};

export function listSubscribers(
  filters: SubscriberFilters,
  page: number,
  sort: { key: SubscriberSortKey; direction: "asc" | "desc" },
  signal?: AbortSignal,
) {
  const params = filterParams(filters);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String((page - 1) * PAGE_SIZE));
  params.set("sort", sort.key);
  params.set("dir", sort.direction);
  return apiJson<SubscriberPage>(`/admin/subscribers?${params}`, { signal });
}

/** Downloads the CSV for the current filters through the browser's save flow. */
export async function exportSubscribers(filters: SubscriberFilters): Promise<void> {
  const res = await apiFetch(`/admin/subscribers/export.csv?${filterParams(filters)}`);
  if (!res.ok) throw new Error("export failed");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "subscribers.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
