import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

/** Block image holding only what the stored format keeps: `src` and `alt`. */
const StoredImage = Image.extend({
  addAttributes() {
    return { src: { default: null }, alt: { default: null } };
  },
}).configure({ inline: false, allowBase64: false });

/**
 * Exactly the nodes and marks the API stores (see `@kcom/content`): paragraph,
 * heading 1-4, lists, blockquote, hard break, image, and bold/italic/underline/link.
 * Everything else StarterKit ships is switched off so it can never be produced.
 */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: { openOnClick: false, autolink: false, protocols: ["http", "https", "mailto"] },
    strike: false,
    trailingNode: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    dropcursor: { color: "var(--color-gold)" },
  }),
  StoredImage,
];

type Node = { type?: string; attrs?: Record<string, unknown>; marks?: Node[]; content?: Node[] };

/**
 * Trims editor-only attributes (link target/rel/class, ordered-list start) so the
 * emitted document carries exactly the attributes the API keeps.
 */
export function toStoredDoc<T extends Node>(node: T): T {
  const out: Node = { ...node };
  if (out.type === "orderedList") delete out.attrs;
  if (out.type === "link" && out.attrs) out.attrs = { href: out.attrs.href };
  if (out.marks) out.marks = out.marks.map(toStoredDoc);
  if (out.content) out.content = out.content.map(toStoredDoc);
  return out as T;
}
