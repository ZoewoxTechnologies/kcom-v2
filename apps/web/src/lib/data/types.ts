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

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
  /** Live capsules published in a Lagos month (YYYY-MM), newest first. */
  listCapsulesInMonth(month: string): Promise<CapsuleListItem[]>;
  /** Every series with live capsules. */
  listSeries(): Promise<SeriesSummary[]>;
  seriesBySlug(slug: string): Promise<SeriesDetail | null>;
}

/**
 * Every DataSource method name; wrappers are built from this. Listing a name that does not exist
 * or leaving one out is a compile error, so adding a method is a one-line change here.
 */
export const dataMethods = ["latestCapsule", "listCapsulesInMonth", "listSeries", "seriesBySlug"] as const satisfies readonly (keyof DataSource)[];

type MissingMethods = Exclude<keyof DataSource, (typeof dataMethods)[number]>;
/** Fails to compile (type `never` is not `true`) when a DataSource method is missing from `dataMethods`. */
export const dataMethodsComplete: [MissingMethods] extends [never] ? true : never = true;
