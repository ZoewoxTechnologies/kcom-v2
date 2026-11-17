/** What the public pages need from a capsule; picked from the API's response. */
export interface CapsuleSummary {
  slug: string;
  title: string;
  /** Calendar day in Africa/Lagos, YYYY-MM-DD. */
  displayDate: string;
  scriptureRef: string | null;
  scriptureText: string | null;
}

export interface DataSource {
  latestCapsule(): Promise<CapsuleSummary | null>;
}
