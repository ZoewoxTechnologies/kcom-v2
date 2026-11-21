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

/** The API pages lists (100 at most per request); the admin loads one page. */
export const listPosts = () =>
  call<{ items: PostRecord[]; total: number }>("?limit=100").then((r) => r.items);

export const getPost = (id: string) => call<PostRecord>(`/${id}`);

export const createPost = (input: PostInput) =>
  call<PostRecord>("", { method: "POST", body: JSON.stringify(input) });

export const updatePost = (id: string, input: Partial<PostInput>) =>
  call<PostRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deletePost = (id: string) => call<void>(`/${id}`, { method: "DELETE" });

export const postEditPath = (id: string) => `/blog/${id}`;
