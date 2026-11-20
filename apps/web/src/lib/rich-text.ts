import { imageSrcSet, imageUrl, isCloudinaryImageUrl } from "@kcom/media";
import { RICH_TEXT_MARKS, RICH_TEXT_NODES, isSafeHref, richTextHeadingLevel } from "@kcom/content";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Node = { type?: unknown; text?: unknown; content?: unknown; marks?: unknown; attrs?: unknown };
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const kids = (n: Node): unknown[] => (Array.isArray(n.content) ? n.content : []);

function mark(html: string, m: unknown): string {
  if (!isNode(m) || typeof m.type !== "string" || !RICH_TEXT_MARKS.has(m.type)) return html;
  if (m.type === "bold") return `<strong>${html}</strong>`;
  if (m.type === "italic") return `<em>${html}</em>`;
  if (m.type === "underline") return `<u>${html}</u>`;
  if (m.type === "link") {
    const href = isNode(m.attrs) ? (m.attrs as { href?: unknown }).href : undefined;
    if (isSafeHref(href)) return `<a href="${esc(href)}">${html}</a>`;
  }
  return html;
}

function render(node: unknown): string {
  if (!isNode(node) || typeof node.type !== "string" || !RICH_TEXT_NODES.has(node.type)) return "";
  const inner = () => kids(node).map(render).join("");
  switch (node.type) {
    case "text": {
      const marks = Array.isArray(node.marks) ? node.marks : [];
      return marks.reduce<string>(mark, esc(typeof node.text === "string" ? node.text : ""));
    }
    case "paragraph":
      return `<p>${inner()}</p>`;
    case "heading": {
      const level = isNode(node.attrs) ? (node.attrs as { level?: unknown }).level : 2;
      const n = Math.max(2, richTextHeadingLevel(level));
      return `<h${n}>${inner()}</h${n}>`;
    }
    case "bulletList":
      return `<ul>${inner()}</ul>`;
    case "orderedList":
      return `<ol>${inner()}</ol>`;
    case "listItem":
      return `<li>${inner()}</li>`;
    case "blockquote":
      return `<blockquote>${inner()}</blockquote>`;
    case "image": {
      const a = isNode(node.attrs) ? (node.attrs as Record<string, unknown>) : {};
      if (typeof a.src !== "string" || !isCloudinaryImageUrl(a.src)) return "";
      const ok = (v: unknown): v is number =>
        typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 20_000;
      const size = ok(a.width) && ok(a.height) ? ` width="${a.width}" height="${a.height}"` : "";
      const widths = [480, 800, 1200];
      return `<img src="${esc(imageUrl(a.src, { width: 800 }))}" srcset="${esc(imageSrcSet(a.src, widths))}" sizes="(min-width: 48rem) 42rem, 100vw" alt="${esc(typeof a.alt === "string" ? a.alt : "")}"${size} loading="lazy" decoding="async">`;
    }
    case "hardBreak":
      return "<br>";
    case "doc":
      return inner();
    default:
      return "";
  }
}

/** Renders a rich-text document to HTML. Unknown nodes are dropped and all text is escaped. */
export function richTextToHtml(doc: unknown): string {
  return render(doc);
}
