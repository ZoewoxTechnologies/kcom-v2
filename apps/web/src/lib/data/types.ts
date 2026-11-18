/** A rich-text document (JSON tree); rendered by `richTextToHtml`. */
export type RichTextDoc = Record<string, unknown>;

/** What the public pages need from a capsule; picked from the API's response. */
export interface CapsuleSummary {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: string | null;
}

/** A published capsule in full. */
export interface Capsule {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: RichTextDoc | null;
  /** Passages to read and meditate on. */
  bibleMeditation: string | null;
  body: RichTextDoc;
  decrees: string[];
  prayer: RichTextDoc | null;
  authorSource: string | null;
  seriesId: string | null;
  partNumber: number | null;
  /** Optional banner photo; the section is hidden when absent. */
  bannerUrl: string | null;
}

/** Enough of a capsule to link to it. */
export interface CapsuleLink {
  slug: string;
  title: string;
  displayDate: string;
  scriptureRef: string | null;
  seriesId: string | null;
  partNumber: number | null;
}

export interface SeriesInfo {
  id: string;
  slug: string;
  title: string;
}

export interface CapsuleListQuery {
  /** YYYY-MM */
  month?: string;
  /** YYYY-MM-DD */
  date?: string;
  series?: string;
  limit?: number;
}

export interface CapsuleNeighbours {
  prev: CapsuleLink | null;
  next: CapsuleLink | null;
}

/** A published blog post, without its body: enough for cards and lists. */
export interface BlogPostSummary {
  slug: string;
  title: string;
  /** Calendar day, YYYY-MM-DD. */
  date: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  tags: string[];
}

/** A published blog post in full. */
export interface BlogPost extends BlogPostSummary {
  body: RichTextDoc;
}

export interface BlogListQuery {
  limit?: number;
  offset?: number;
}

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
  capsuleBySlug(slug: string): Promise<Capsule | null>;
  capsuleByDate(date: string): Promise<Capsule | null>;
  /** Published capsules, newest first. */
  listCapsules(query: CapsuleListQuery): Promise<CapsuleLink[]>;
  /** The nearest published capsules before and after the one with this slug. */
  capsuleNeighbours(slug: string): Promise<CapsuleNeighbours | null>;
  listSeries(): Promise<SeriesInfo[]>;
  /** Published posts, newest first. */
  listBlogPosts(query?: BlogListQuery): Promise<BlogPostSummary[]>;
  blogPostBySlug(slug: string): Promise<BlogPost | null>;
}

/**
 * Every DataSource method name; wrappers are built from this. Listing a name that does not exist
 * or leaving one out is a compile error, so adding a method is a one-line change here.
 */
export const dataMethods = [
  "latestCapsule",
  "capsuleBySlug",
  "capsuleByDate",
  "capsuleNeighbours",
  "listCapsules",
  "listSeries",
  "listBlogPosts",
  "blogPostBySlug",
] as const satisfies readonly (keyof DataSource)[];

type MissingMethods = Exclude<keyof DataSource, (typeof dataMethods)[number]>;
/** Fails to compile (type `never` is not `true`) when a DataSource method is missing from `dataMethods`. */
export const dataMethodsComplete: [MissingMethods] extends [never] ? true : never = true;
