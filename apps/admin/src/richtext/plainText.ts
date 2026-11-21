type Node = { type?: string; text?: string; content?: Node[] };

/** Plain text of a rich-text document, one paragraph per line. */
export function richTextToPlain(doc: Record<string, unknown> | null): string {
  const text = (n: Node): string =>
    n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(text).join("");
  return ((doc as Node | null)?.content ?? []).map(text).join("\n");
}

/** A document with one paragraph per line, or null when there is no text. */
export function plainToRichText(plain: string): Record<string, unknown> | null {
  const lines = plain.split("\n").map((l) => l.trimEnd());
  if (!lines.some((l) => l.trim())) return null;
  return {
    type: "doc",
    content: lines.map((line) =>
      line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" },
    ),
  };
}
