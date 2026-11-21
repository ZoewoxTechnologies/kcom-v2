import { apiJson } from "../api/client";

export type EventStatus = "draft" | "published";

export interface EventRecord {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  description: Record<string, unknown> | null;
  allDay: boolean;
  onlineUrl: string | null;
  programme: string | null;
  relatedPostId: string | null;
  status: EventStatus;
}

export interface EventInput {
  title: string;
  slug?: string;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  /** Left out when unchanged, so existing rich content is never overwritten. */
  description?: Record<string, unknown> | null;
  allDay: boolean;
  onlineUrl: string | null;
  programme: string | null;
  relatedPostId: string | null;
  status: EventStatus;
}

export interface PostOption {
  id: string;
  title: string;
}

/** Published posts, for linking an event to its write-up. */
export const listPostOptions = () =>
  apiJson<{ items: (PostOption & { status: string })[] }>(
    "/admin/blog?status=published&limit=100",
  ).then((r) => r.items.map(({ id, title }) => ({ id, title })));

const call = <T>(path: string, init?: RequestInit) => apiJson<T>(`/admin/events${path}`, init);

/**
 * The API pages lists (100 at most per request). The admin list loads one page;
 * the ministry has far fewer events than that. Add paging here if it ever grows.
 */
export const listEvents = () =>
  call<{ items: EventRecord[]; total: number }>("?limit=100").then((r) => r.items);

/** Published events that have not ended: how many, and when the next one starts. */
export const upcomingEventsSummary = () =>
  call<{ total: number; next: string | null }>("/upcoming");

export const createEvent = (input: EventInput) =>
  call<EventRecord>("", { method: "POST", body: JSON.stringify(input) });

export const updateEvent = (id: string, input: Partial<EventInput>) =>
  call<EventRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteEvent = (id: string) => call<void>(`/${id}`, { method: "DELETE" });

export { plainToRichText, richTextToPlain } from "../richtext/plainText";
