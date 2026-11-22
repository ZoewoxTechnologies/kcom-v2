import { emptyRichText } from "../richtext/RichTextEditor";
import type { SectionData } from "./api";

/** A block with a stable client-side key, so reordering keeps its form state. */
export interface Block extends SectionData {
  id: string;
}

let counter = 0;
export const withId = (s: SectionData): Block => ({ ...s, id: `b${++counter}` });
export const withoutId = ({ type, props }: Block): SectionData => ({ type, props });

export const blankProps = (type: string): Record<string, unknown> => {
  switch (type) {
    case "richText":
      return { body: emptyRichText };
    case "cardGrid":
      return { cards: [] };
    default:
      return {};
  }
};

/** Drops blank strings (the API rejects them) from block props; rich-text bodies pass through. */
export function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => !(typeof v === "string" && v.trim() === ""))
        .map(([k, v]) => [k, k === "body" ? v : clean(v)]),
    );
  }
  return typeof value === "string" ? value.trim() : value;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Required-field messages for a block, keyed by field. */
export function validateBlock({ type, props }: SectionData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (type === "hero" && !str(props.heading)) errors.heading = "Enter a heading.";
  if (type === "quote" && !str(props.text)) errors.text = "Enter the quote.";
  if (type === "image" && !str(props.url)) errors.url = "Add an image.";
  if (type === "cta") {
    if (!str(props.label)) errors.label = "Enter the button label.";
    if (!str(props.url)) errors.url = "Enter a link.";
  }
  if (type === "cardGrid") {
    const cards = (props.cards as { title?: unknown }[] | undefined) ?? [];
    if (cards.some((c) => !str(c.title))) errors.cards = "Every card needs a title.";
  }
  return errors;
}
