/**
 * The one definition of which rich-text nodes, marks and links are allowed.
 * The API sanitiser (on write) and the site renderer (on read) both use it.
 */
export const RICH_TEXT_NODES: ReadonlySet<string> = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "image",
]);

export const RICH_TEXT_MARKS: ReadonlySet<string> = new Set([
  "bold",
  "italic",
  "underline",
  "link",
]);

const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s]+$/i;

/** Only http(s) and mailto links are kept. */
export const isSafeHref = (href: unknown): href is string =>
  typeof href === "string" && SAFE_HREF.test(href);

/** Heading levels allowed in content; anything else becomes 2. */
export const richTextHeadingLevel = (level: unknown): 1 | 2 | 3 | 4 =>
  level === 1 || level === 2 || level === 3 || level === 4 ? level : 2;
