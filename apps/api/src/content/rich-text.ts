import { z } from "zod";
import { isCloudinaryImageUrl } from "@kcom/media";
import { RICH_TEXT_MARKS, RICH_TEXT_NODES, isSafeHref, richTextHeadingLevel } from "@kcom/content";
import type { RichText } from "@kcom/db";

/**
 * Rich text is a JSON document tree (type / attrs / content / marks / text).
 * Sanitising keeps only known nodes, marks and attributes, and drops links that
 * are not http(s)/mailto, so nothing script-bearing is ever stored.
 */
const MAX_DEPTH = 12;
const MAX_TEXT = 50_000;

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function cleanMarks(marks: unknown): Raw[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: Raw[] = [];
  for (const m of marks) {
    if (!isObj(m) || typeof m.type !== "string" || !RICH_TEXT_MARKS.has(m.type)) continue;
    if (m.type === "link") {
      const href = isObj(m.attrs) ? m.attrs.href : undefined;
      if (isSafeHref(href)) {
        out.push({ type: "link", attrs: { href } });
      }
    } else out.push({ type: m.type });
  }
  return out.length ? out : undefined;
}

function cleanNode(node: unknown, depth: number): Raw | null {
  if (
    !isObj(node) ||
    typeof node.type !== "string" ||
    !RICH_TEXT_NODES.has(node.type) ||
    depth > MAX_DEPTH
  ) {
    return null;
  }
  const out: Raw = { type: node.type };
  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text.length > MAX_TEXT) return null;
    out.text = node.text;
    const marks = cleanMarks(node.marks);
    if (marks) out.marks = marks;
    return out;
  }
  if (node.type === "heading") {
    const level = isObj(node.attrs) ? node.attrs.level : undefined;
    out.attrs = { level: richTextHeadingLevel(level) };
  }
  if (node.type === "image") {
    // Cloudinary-hosted images only, and alt text is required; otherwise the image is dropped.
    const attrs = isObj(node.attrs) ? node.attrs : {};
    if (typeof attrs.src !== "string" || !isCloudinaryImageUrl(attrs.src)) return null;
    if (typeof attrs.alt !== "string") return null;
    const size = (v: unknown) =>
      Number.isInteger(v) && (v as number) > 0 && (v as number) <= 20_000
        ? (v as number)
        : undefined;
    const width = size(attrs.width);
    const height = size(attrs.height);
    out.attrs = {
      src: attrs.src,
      alt: attrs.alt.slice(0, 300),
      ...(width && height ? { width, height } : {}),
    };
    return out;
  }
  if (Array.isArray(node.content)) {
    out.content = node.content
      .map((c) => cleanNode(c, depth + 1))
      .filter((c): c is Raw => c !== null);
  }
  return out;
}

export function sanitizeRichText(input: unknown): RichText | null {
  const node = cleanNode(input, 0);
  return node && node.type === "doc" ? node : null;
}

/** A rich-text document: must be a `doc` node; unsafe content is stripped. */
export const richTextSchema = z
  .custom<unknown>(isObj, "must be a JSON document")
  .transform((value, ctx) => {
    const clean = sanitizeRichText(value);
    if (!clean) {
      ctx.addIssue({ code: "custom", message: 'must be a document with type "doc"' });
      return z.NEVER;
    }
    return clean;
  });
