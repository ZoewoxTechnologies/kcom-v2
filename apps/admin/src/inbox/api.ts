import { apiJson } from "../api/client";
import type { ContactTopic } from "@kcom/db/contact-topics";

export type MessageStatus = "new" | "read";

export interface ContactMessage {
  id: string;
  topic: ContactTopic;
  name: string;
  email: string;
  message: string;
  keepPrivate: boolean;
  status: MessageStatus;
  createdAt: string;
}

export interface MessageFilters {
  status?: MessageStatus;
  topic?: ContactTopic;
}

export const PAGE_SIZE = 25;

const call = <T>(path: string, init?: RequestInit) =>
  apiJson<T>(`/admin/contact-messages${path}`, init);

export const listMessages = (filters: MessageFilters, page: number) => {
  const q = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (filters.status) q.set("status", filters.status);
  if (filters.topic) q.set("topic", filters.topic);
  return call<{ items: ContactMessage[]; total: number }>(`?${q}`);
};

export const setMessageStatus = (id: string, status: MessageStatus) =>
  call<ContactMessage>(`/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });

export const fetchUnreadCount = () =>
  call<{ unread: number }>("/unread-count").then((r) => r.unread);
