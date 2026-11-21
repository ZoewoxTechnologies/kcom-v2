import { apiJson } from "../api/client";
import type { RichTextDoc } from "../richtext/RichTextEditor";

export type BookStatus = "draft" | "published";

export interface BookRecord {
  id: string;
  title: string;
  slug: string;
  description: RichTextDoc | null;
  coverUrl: string | null;
  purchaseUrl: string | null;
  position: number;
  status: BookStatus;
}

export interface BookInput {
  title: string;
  slug?: string;
  description: RichTextDoc | null;
  coverUrl: string | null;
  purchaseUrl: string | null;
  position?: number;
  status: BookStatus;
}

const call = <T>(path: string, init?: RequestInit) => apiJson<T>(`/admin/books${path}`, init);

/** Books in their saved order. One page is enough: the ministry has a few dozen titles. */
export const listBooks = () => call<{ items: BookRecord[] }>("?limit=100").then((r) => r.items);

export const createBook = (input: BookInput) =>
  call<BookRecord>("", { method: "POST", body: JSON.stringify(input) });

export const updateBook = (id: string, input: Partial<BookInput>) =>
  call<BookRecord>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteBook = (id: string) => call<void>(`/${id}`, { method: "DELETE" });

/** Saves the order: every book id, first to last. */
export const saveBookOrder = (ids: string[]) =>
  call<unknown>("/order", { method: "PUT", body: JSON.stringify({ ids }) });
