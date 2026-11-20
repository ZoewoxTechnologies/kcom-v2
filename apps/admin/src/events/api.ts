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

export const createEvent = (input: EventInput) =>
  call<EventRecord>("", { method: "POST", body: JSON.stringify(input) });

export const updateEvent = (id: string, input: Partial<EventInput>) =>
  call<EventRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteEvent = (id: string) => call<void>(`/${id}`, { method: "DELETE" });

type Node = { type?: string; text?: string; content?: Node[] };

/** Plain text of a rich-text document, one paragraph per line. */
export function richTextToPlain(doc: Record<string, unknown> | null): string {
  const text = (n: Node): string =>
    n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(text).join("");
  return ((doc as Node | null)?.content ?? []).map(text).join("\n");
}

/** A document with one paragraph per line, or null when there is no text. */
export function plainToRichText(plain: string): Record<string, unknown> | null {
  const lines = plain.split("\n").map((l) => l.trimEnd());
  if (!lines.some((l) => l.trim())) return null;
  return {
    type: "doc",
    content: lines.map((line) =>
      line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" },
    ),
  };
}
