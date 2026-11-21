/** The site pages an editor can change, and the kinds of block each may hold. */
export interface EditablePage {
  slug: string;
  title: string;
  /** Where the page lives on the public site. */
  path: string;
  summary: string;
  allowed: readonly string[];
  /** Shown above the blocks. */
  note?: string;
}

export const EDITABLE_PAGES: readonly EditablePage[] = [
  {
    slug: "about",
    title: "About: Who We Are",
    path: "/about",
    summary: "The ministry’s story, vision and calling.",
    allowed: ["hero", "richText", "quote", "image", "cta"],
  },
  {
    slug: "about-team",
    title: "About: Team and Arms",
    path: "/about/team",
    summary: "The introduction above the team and arms lists.",
    allowed: ["hero", "richText"],
    note: "Team members and arms are edited under Settings.",
  },
  {
    slug: "partner",
    title: "Partnership",
    path: "/partner",
    summary: "Ways to partner and how to give.",
    allowed: ["hero", "richText", "cardGrid", "cta", "bankDetails"],
    note: "Bank details come from Settings.",
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    path: "/privacy",
    summary: "How visitor information is handled.",
    allowed: ["richText"],
  },
];

export const BLOCK_LABELS: Record<string, string> = {
  hero: "Title band",
  richText: "Text",
  quote: "Quote",
  image: "Image",
  cardGrid: "Card grid",
  columns: "Columns",
  cta: "Call to action",
  bankDetails: "Bank details",
};
