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

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
  capsuleBySlug(slug: string): Promise<Capsule | null>;
  capsuleByDate(date: string): Promise<Capsule | null>;
  /** Published capsules, newest first. */
  listCapsules(query: CapsuleListQuery): Promise<CapsuleLink[]>;
  listSeries(): Promise<SeriesInfo[]>;
}
