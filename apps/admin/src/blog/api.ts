import { apiJson } from "../api/client";
import type { RichTextDoc } from "../richtext/RichTextEditor";

export type PostStatus = "draft" | "scheduled" | "published";

export interface PostRecord {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  body: RichTextDoc;
  heroImageUrl: string | null;
  tags: string[];
  authorId: string | null;
  status: PostStatus;
  publishAt: string | null;
  updatedAt?: string;
}

export interface PostInput {
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  body: RichTextDoc;
  heroImageUrl: string | null;
  tags: string[];
  status: PostStatus;
}

const call = <T>(path: string, init?: RequestInit) => apiJson<T>(`/admin/blog${path}`, init);

const PAGE = 100;

/** Every post. The API pages lists (100 at most per request), so this reads page after page. */
export async function listPosts(): Promise<PostRecord[]> {
  const all: PostRecord[] = [];
  for (;;) {
    const { items, total } = await call<{ items: PostRecord[]; total: number }>(
      `?limit=${PAGE}&offset=${all.length}`,
    );
    all.push(...items);
    if (items.length < PAGE || all.length >= total) return all;
  }
}

export const getPost = (id: string) => call<PostRecord>(`/${id}`);

export const createPost = (input: PostInput) =>
  call<PostRecord>("", { method: "POST", body: JSON.stringify(input) });

export const updatePost = (id: string, input: Partial<PostInput>) =>
  call<PostRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deletePost = (id: string) => call<void>(`/${id}`, { method: "DELETE" });

export const postEditPath = (id: string) => `/blog/${id}`;
