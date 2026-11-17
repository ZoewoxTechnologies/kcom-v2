/** What the public pages need from a capsule; the API returns more. */
export interface CapsuleSummary {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: string | null;
  seriesId: string | null;
}

export interface SeriesSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
  listSeries(): Promise<SeriesSummary[]>;
}
