/** What the public pages need from a capsule; picked from the API's response. */
export interface CapsuleSummary {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: string | null;
}

/** A capsule as listed in the archive. */
export interface CapsuleListItem {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  partNumber: number | null;
  seriesTitle: string | null;
}

/** A series that has live capsules, with figures derived from those capsules. */
export interface SeriesSummary {
  slug: string;
  title: string;
  description: string | null;
  /** Number of live capsules. */
  count: number;
  /** Lagos days (YYYY-MM-DD) of the first and latest capsule. */
  firstDate: string;
  lastDate: string;
  /** Latest part published today or yesterday (Lagos), so the series is still running. */
  inProgress: boolean;
  /** Highest part number so far (or the capsule count when parts are unnumbered). */
  latestPart: number;
}

export interface SeriesDetail {
  series: SeriesSummary;
  /** Oldest first (Day 1 first). */
  capsules: CapsuleListItem[];
}

/** A rich-text document (JSON tree); rendered by `richTextToHtml`. */
export type RichTextDoc = Record<string, unknown>;

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
  series: { slug: string; title: string } | null;
  partNumber: number | null;
  /** Optional banner photo; the section is hidden when absent. */
  bannerUrl: string | null;
}

/** Enough of a capsule to link to it. */
export type CapsuleLink = Pick<CapsuleListItem, "slug" | "title" | "displayDate" | "scriptureRef">;

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

/** A published event in full. Optional parts are null when not set. */
export interface EventDetail {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  place: string | null;
  description: RichTextDoc | null;
  imageUrl: string | null;
  /** Join link when the event is also online. */
  onlineUrl: string | null;
  /** One "time · item" line per entry. */
  programme: string | null;
  /** The write-up, once it is published. */
  relatedPost: { slug: string; title: string } | null;
}

/** An event as listed on the Events page. */
export interface EventSummary {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  place: string | null;
  /** Plain-text description. */
  summary: string | null;
  /** Also streamed online. */
  online: boolean;
}

export interface BlogListQuery {
  limit?: number;
  offset?: number;
}

/** A published book, as listed on the Books page. */
export interface Book {
  slug: string;
  title: string;
  /** Plain-text blurb. */
  description: string | null;
  coverUrl: string | null;
  purchaseUrl: string | null;
  publishedYear: number | null;
  /** Not in the API yet: null there, so the kind label and filter stay hidden. */
  kind: BookKind | null;
  author: string | null;
  sampleUrl: string | null;
}

export const bookKinds = ["Book", "Mini-book", "New Year message"] as const;
export type BookKind = (typeof bookKinds)[number];

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
  capsuleBySlug(slug: string): Promise<Capsule | null>;
  /** The capsule published on a Lagos day (YYYY-MM-DD). */
  capsuleByDate(date: string): Promise<Capsule | null>;
  /** The nearest published capsules before and after the one with this slug. */
  capsuleNeighbours(slug: string): Promise<CapsuleNeighbours | null>;
  /** Live capsules published in a Lagos month (YYYY-MM), newest first. */
  listCapsulesInMonth(month: string): Promise<CapsuleListItem[]>;
  /** Every series with live capsules. */
  listSeries(): Promise<SeriesSummary[]>;
  seriesBySlug(slug: string): Promise<SeriesDetail | null>;
  /** Published posts, newest first. */
  listBlogPosts(query?: BlogListQuery): Promise<BlogPostSummary[]>;
  blogPostBySlug(slug: string): Promise<BlogPost | null>;
  /** Published books, A to Z. */
  listBooks(): Promise<Book[]>;
  eventBySlug(slug: string): Promise<EventDetail | null>;
  /** Published events: upcoming soonest first, past newest first. */
  listEvents(when: "upcoming" | "past"): Promise<EventSummary[]>;
  /** Visible homepage sections as the API names them, in display order. Empty when unknown. */
  listHomepageSections(): Promise<string[]>;
}

/**
 * Every DataSource method name; wrappers are built from this. Listing a name that does not exist
 * or leaving one out is a compile error, so adding a method is a one-line change here.
 */
export const dataMethods = ["latestCapsule", "capsuleBySlug", "capsuleByDate", "capsuleNeighbours", "listCapsulesInMonth", "listSeries", "seriesBySlug", "listBlogPosts", "blogPostBySlug", "listBooks", "eventBySlug", "listEvents", "listHomepageSections"] as const satisfies readonly (keyof DataSource)[];

type MissingMethods = Exclude<keyof DataSource, (typeof dataMethods)[number]>;
/** Fails to compile (type `never` is not `true`) when a DataSource method is missing from `dataMethods`. */
export const dataMethodsComplete: [MissingMethods] extends [never] ? true : never = true;
