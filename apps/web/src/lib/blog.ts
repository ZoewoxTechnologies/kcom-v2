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

const FETCH_SIZE = 100;

/** Every published post, newest first, walking the API's pages. */
export async function allBlogPosts(src: DataSource): Promise<BlogPostSummary[]> {
  const out: BlogPostSummary[] = [];
  for (let offset = 0; ; offset += FETCH_SIZE) {
    const rows = await src.listBlogPosts({ limit: FETCH_SIZE, offset });
    out.push(...rows);
    if (rows.length < FETCH_SIZE) return out;
  }
}

/** The latest posts other than this one. */
export async function relatedPosts(src: DataSource, post: BlogPost, count = 3): Promise<BlogPostSummary[]> {
  const rows = await src.listBlogPosts({ limit: count + 1 });
  return rows.filter((r) => r.slug !== post.slug).slice(0, count);
}
