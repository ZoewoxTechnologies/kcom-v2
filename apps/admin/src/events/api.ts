export type EventStatus = "draft" | "published";

export interface EventRecord {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  description: Record<string, unknown> | null;
  status: EventStatus;
}

export interface EventInput {
  title: string;
  slug?: string;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  description: Record<string, unknown> | null;
  status: EventStatus;
}

/** A failed API call; `code` is the API's error code, such as "conflict". */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const baseUrl = () => (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}/admin/events${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(body?.error?.message ?? "request failed", res.status, body?.error?.code);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const listEvents = () =>
  call<{ items: EventRecord[]; total: number }>("?limit=100").then((r) => r.items);

export const createEvent = (input: EventInput) =>
  call<EventRecord>("", { method: "POST", body: JSON.stringify(input) });

export const updateEvent = (id: string, input: Partial<EventInput>) =>
  call<EventRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteEvent = (id: string) => call<void>(`/${id}`, { method: "DELETE" });

/** Lowercase ASCII words joined by hyphens, as the API requires for slugs. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
