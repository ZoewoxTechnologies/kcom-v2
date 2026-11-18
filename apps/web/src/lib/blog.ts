import { dayParts } from "@kcom/content";
import type { BlogPost, BlogPostSummary, DataSource } from "./data/types";
import { richTextToPlain } from "./data/client";

export const BLOG_PAGE_SIZE = 9;
const WORDS_PER_MINUTE = 200;

/** Whole minutes to read a rich-text document; at least 1. */
export function readingMinutes(body: unknown): number {
  const words = richTextToPlain(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** "New Year Message · 1 January 2026": first tag (if any) and the long date. */
export function postKicker(post: Pick<BlogPostSummary, "tags" | "date">): string {
  return [post.tags[0], dayParts(post.date).rest].filter(Boolean).join(" · ");
}

export interface BlogPage {
  posts: BlogPostSummary[];
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/** One page of the index. Asks for one extra row to know whether a next page exists. */
export async function loadBlogPage(src: DataSource, page: number, size = BLOG_PAGE_SIZE): Promise<BlogPage> {
  const rows = await src.listBlogPosts({ limit: size + 1, offset: (page - 1) * size });
  return { posts: rows.slice(0, size), page, hasPrev: page > 1, hasNext: rows.length > size };
}

/** The latest posts other than this one. */
export async function relatedPosts(src: DataSource, post: BlogPost, count = 3): Promise<BlogPostSummary[]> {
  const rows = await src.listBlogPosts({ limit: count + 1 });
  return rows.filter((r) => r.slug !== post.slug).slice(0, count);
}

/** Page number from a query value; anything but a positive integer is 1. */
export function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
