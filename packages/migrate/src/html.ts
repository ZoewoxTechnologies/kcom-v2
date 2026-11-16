/** Tiptap-style JSON node. */
export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}
export interface RichDoc extends RichNode {
  type: "doc";
  content: RichNode[];
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", bull: "•", middot: "·", copy: "©", eacute: "é", egrave: "è",
  aacute: "á", agrave: "à", oacute: "ó", uacute: "ú", iacute: "í", ntilde: "ñ",
  euml: "ë", ouml: "ö", uuml: "ü", auml: "ä", deg: "°", sect: "§", para: "¶",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const MARKS: Record<string, string> = { em: "italic", i: "italic", strong: "bold", b: "bold", u: "underline" };
const BLOCKS = new Set(["p", "div", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);
const DROP = new Set(["script", "style"]);

type Mark = NonNullable<RichNode["marks"]>[number];
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/g;

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  const v = m?.[1] ?? m?.[2] ?? m?.[3];
  return v === undefined ? undefined : decodeEntities(v);
}

/** Collapses whitespace like a browser would for inline content. */
const collapse = (s: string) => s.replace(/[\s ]+/g, " ");

/**
 * Converts the legacy HTML (paragraphs, lists, emphasis, links, images) into a
 * Tiptap-compatible JSON document. Unknown tags are unwrapped; scripts and
 * styles are dropped; empty paragraphs are removed.
 */
export function htmlToDoc(html: string): RichDoc {
  const root: RichNode = { type: "doc", content: [] };
  const stack: RichNode[] = [root];
  const marks: Mark[] = [];
  let skip = 0;

  const top = () => stack[stack.length - 1] as RichNode;
  const isTextBlock = (n: RichNode) => n.type === "paragraph" || n.type === "heading";

  /** Returns the container that inline content should go into, opening a paragraph if needed. */
  const inlineTarget = (): RichNode => {
    const t = top();
    if (isTextBlock(t)) return t;
    const p: RichNode = { type: "paragraph", content: [] };
    (t.content ??= []).push(p);
    stack.push(p);
    return p;
  };
  const closeImplicit = () => {
    const t = top();
    if (isTextBlock(t) && !(t as { explicit?: boolean }).explicit) stack.pop();
  };
  const addText = (text: string) => {
    const target = inlineTarget();
    const prev = target.content?.[target.content.length - 1];
    const ms = marks.map((m) => ({ ...m }));
    if (prev?.type === "text" && JSON.stringify(prev.marks ?? []) === JSON.stringify(ms)) {
      prev.text += text;
      return;
    }
    const node: RichNode = { type: "text", text };
    if (ms.length) node.marks = ms;
    (target.content ??= []).push(node);
  };

  for (const m of html.matchAll(TOKEN)) {
    const [, closing, rawName, attrs = "", text] = m;
    if (text !== undefined) {
      if (skip) continue;
      const t = collapse(decodeEntities(text));
      if (t.trim() === "" && !isTextBlock(top())) continue;
      addText(t);
      continue;
    }
    if (!rawName) continue;
    const name = rawName.toLowerCase();
    if (DROP.has(name)) {
      skip += closing ? -1 : 1;
      if (skip < 0) skip = 0;
      continue;
    }
    if (skip) continue;

    if (MARKS[name]) {
      if (closing) {
        const i = marks.map((x) => x.type).lastIndexOf(MARKS[name]);
        if (i >= 0) marks.splice(i, 1);
      } else marks.push({ type: MARKS[name] });
      continue;
    }
    if (name === "a") {
      if (closing) {
        const i = marks.map((x) => x.type).lastIndexOf("link");
        if (i >= 0) marks.splice(i, 1);
      } else {
        const href = attr(attrs, "href");
        if (href) marks.push({ type: "link", attrs: { href } });
      }
      continue;
    }
    if (name === "br") {
      if (isTextBlock(top())) (top().content ??= []).push({ type: "hardBreak" });
      continue;
    }
    if (name === "img") {
      const src = attr(attrs, "src");
      if (src) {
        closeImplicit();
        const img: RichNode = { type: "image", attrs: { src, alt: attr(attrs, "alt") ?? null } };
        (top().content ??= []).push(img);
      }
      continue;
    }
    if (name === "hr") continue;
    if (!BLOCKS.has(name)) continue;

    if (closing) {
      closeImplicit();
      // Pop to the matching container.
      const type = name === "ul" ? "bulletList" : name === "ol" ? "orderedList" : name === "li" ? "listItem" : name === "blockquote" ? "blockquote" : name.startsWith("h") ? "heading" : "paragraph";
      if (name === "div") continue;
      const idx = stack.map((n) => n.type).lastIndexOf(type);
      if (idx > 0) stack.length = idx;
      continue;
    }

    closeImplicit();
    if (name === "div") continue;
    let node: RichNode;
    if (name === "p") node = { type: "paragraph", content: [] };
    else if (name === "ul") node = { type: "bulletList", content: [] };
    else if (name === "ol") node = { type: "orderedList", content: [] };
    else if (name === "li") node = { type: "listItem", content: [] };
    else if (name === "blockquote") node = { type: "blockquote", content: [] };
    else node = { type: "heading", attrs: { level: Math.min(Number(name[1]), 4) }, content: [] };
    // A list item's content must be block nodes; a stray block outside a list item gets a list wrapper.
    if ((name === "li") && top().type !== "bulletList" && top().type !== "orderedList") {
      const list: RichNode = { type: "bulletList", content: [] };
      (top().content ??= []).push(list);
      stack.push(list);
    }
    (top().content ??= []).push(node);
    (node as { explicit?: boolean }).explicit = name === "p" || name.startsWith("h");
    stack.push(node);
  }

  return { type: "doc", content: clean(root.content ?? []) };
}

/** Trims paragraph edges, drops empty blocks, and strips helper flags. */
function clean(nodes: RichNode[]): RichNode[] {
  const out: RichNode[] = [];
  for (const n of nodes) {
    delete (n as { explicit?: boolean }).explicit;
    if (n.type === "paragraph" || n.type === "heading") {
      const c = n.content ?? [];
      while (c[0]?.type === "text" && c[0].text !== undefined && /^\s*$/.test(c[0].text)) c.shift();
      while (c.length && c[c.length - 1]?.type === "text" && /^\s*$/.test(c[c.length - 1]?.text ?? "")) c.pop();
      const first = c[0];
      if (first?.type === "text" && first.text) first.text = first.text.replace(/^\s+/, "");
      const last = c[c.length - 1];
      if (last?.type === "text" && last.text) last.text = last.text.replace(/\s+$/, "");
      if (c.length === 0) continue;
      n.content = c;
    } else if (n.content) {
      n.content = clean(n.content);
      if (n.content.length === 0 && n.type !== "image") continue;
    }
    out.push(n);
  }
  return out;
}

/** Plain text of a node tree. */
export function nodeText(n: RichNode): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  return (n.content ?? []).map(nodeText).join("");
}

/** Image sources used in a document. */
export function imageSources(n: RichNode): string[] {
  const out: string[] = [];
  if (n.type === "image" && typeof n.attrs?.src === "string") out.push(n.attrs.src);
  for (const c of n.content ?? []) out.push(...imageSources(c));
  return out;
}

export const textDoc = (text: string): RichDoc => ({
  type: "doc",
  content: text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
});
